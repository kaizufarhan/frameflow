import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Aperture, ChevronDown, ChevronLeft, ChevronRight, Download, Film,
  Focus, HelpCircle, Image as ImageIcon, Italic, Maximize2, Pause, Play, Plus, Redo2, RotateCcw,
  Sparkles, Trash2, Type as TypeIcon, Undo2, Upload, Volume2, VolumeX, X,
} from 'lucide-react'
import { BACKGROUNDS, DEFAULT_CANVAS_STYLE, getBackground } from './backgrounds'
import { cameraAt, constrainCamera, formatTime, FULL_VIEW } from './camera'
import { prepareBackgroundCanvas, roundedRectPath, screenRect, videoRect } from './scene'
import { drawTextPresentation, effectiveTextWidth, textPresentationsAt } from './text'
import { timelineTicks } from './timeline'
import sampleVideoUrl from './background-images/demo-video/Sample-video.mp4?url'
import type { CameraPoint, CameraState, CanvasStyle, Easing, TextOverlay } from './types'

const seedPoints: CameraPoint[] = [
  { id: 'full-start', time: 0, x: 50, y: 50, zoom: 100, duration: 600, easing: 'smooth', hold: 0 },
]

interface EditorSnapshot {
  points: CameraPoint[]
  canvasStyle: CanvasStyle
}

type InspectorMode = 'camera' | 'canvas'

function uid() { return Math.random().toString(36).slice(2, 9) }

export default function App() {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const screenRef = useRef<HTMLDivElement>(null)
  const exportCanvasRef = useRef<HTMLCanvasElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const dragRef = useRef<{ kind: 'move' | 'resize'; startX: number; startY: number; point: CameraPoint } | null>(null)
  const textDragRef = useRef<{ startX: number; startY: number; pointId: string; overlay: TextOverlay } | null>(null)
  const rafRef = useRef<number>(0)
  const [videoUrl, setVideoUrl] = useState('')
  const [fileName, setFileName] = useState('')
  const [videoAspect, setVideoAspect] = useState(16 / 9)
  const [duration, setDuration] = useState(12)
  const [currentTime, setCurrentTime] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [points, setPoints] = useState<CameraPoint[]>(seedPoints)
  const [canvasStyle, setCanvasStyle] = useState<CanvasStyle>(DEFAULT_CANVAS_STYLE)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [inspectorMode, setInspectorMode] = useState<InspectorMode>('camera')
  const [history, setHistory] = useState<EditorSnapshot[]>([])
  const [future, setFuture] = useState<EditorSnapshot[]>([])
  const [advancedOpen, setAdvancedOpen] = useState(true)
  const [isExporting, setIsExporting] = useState(false)
  const [exportProgress, setExportProgress] = useState(0)
  const [toast, setToast] = useState('')
  const [canvasHeight, setCanvasHeight] = useState(0)

  const selected = points.find(p => p.id === selectedId) ?? null
  const selectedText = selected?.textOverlays?.find(overlay => overlay.id === selectedTextId) ?? null
  const liveCamera = useMemo(() => selected ?? cameraAt(currentTime, points), [selected, currentTime, points])
  const sortedPoints = useMemo(() => [...points].sort((a, b) => a.time - b.time), [points])
  const previewTexts = useMemo(() => selected
    ? (selected.textOverlays ?? []).filter(overlay => overlay.text.trim()).map(overlay => ({ overlay, opacity: 1, translateY: 0, scale: 1 }))
    : textPresentationsAt(currentTime, points), [selected, currentTime, points])
  const previewScale = canvasHeight > 0 ? canvasHeight / 1080 : 1
  const activeBackground = getBackground(canvasStyle.backgroundId)
  const previewFrame = screenRect(1600, 900, canvasStyle, videoAspect)
  const previewFrameStyle = {
    left: `${previewFrame.x / 1600 * 100}%`,
    top: `${previewFrame.y / 900 * 100}%`,
    width: `${previewFrame.width / 1600 * 100}%`,
    height: `${previewFrame.height / 900 * 100}%`,
  }

  const snapshot = useCallback(() => {
    setHistory(h => [...h.slice(-29), { points, canvasStyle }])
    setFuture([])
  }, [points, canvasStyle])

  const commitPoints = useCallback((next: CameraPoint[], save = true) => {
    if (save) snapshot()
    setPoints(next.sort((a, b) => a.time - b.time))
  }, [snapshot])

  const updateCanvasStyle = (patch: Partial<CanvasStyle>, save = true) => {
    if (save) snapshot()
    setCanvasStyle(current => ({ ...current, ...patch }))
  }

  const showToast = (message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  useEffect(() => () => { if (videoUrl) URL.revokeObjectURL(videoUrl) }, [videoUrl])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !('ResizeObserver' in window)) return
    const observer = new ResizeObserver(entries => setCanvasHeight(entries[0]?.contentRect.height ?? 0))
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [videoUrl])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const sync = () => {
      setCurrentTime(video.currentTime)
      if (!video.paused) rafRef.current = requestAnimationFrame(sync)
    }
    if (isPlaying) rafRef.current = requestAnimationFrame(sync)
    return () => cancelAnimationFrame(rafRef.current)
  }, [isPlaying])

  const loadVideo = (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('video/')) return showToast('Please choose an MP4 or MOV video.')
    if (videoUrl) URL.revokeObjectURL(videoUrl)
    const url = URL.createObjectURL(file)
    setVideoUrl(url)
    setFileName(file.name)
    setVideoAspect(16 / 9)
    setPoints(seedPoints)
    setCanvasStyle(DEFAULT_CANVAS_STYLE)
    setSelectedId(null)
    setSelectedTextId(null)
    setInspectorMode('camera')
    setCurrentTime(0)
    setHistory([])
    setFuture([])
  }

  const seek = (time: number) => {
    const next = Math.max(0, Math.min(duration, time))
    setCurrentTime(next)
    if (videoRef.current) videoRef.current.currentTime = next
  }

  const togglePlay = async () => {
    const video = videoRef.current
    if (!videoUrl || !video) return showToast('Upload a video to start previewing.')
    setSelectedId(null)
    setSelectedTextId(null)
    if (video.paused) {
      if (video.currentTime >= duration - 0.05) seek(0)
      await video.play()
      setIsPlaying(true)
    } else {
      video.pause()
      setIsPlaying(false)
    }
  }

  const openCanvasInspector = () => {
    if (!videoUrl) return showToast('Upload a video before styling the canvas.')
    videoRef.current?.pause()
    setIsPlaying(false)
    setSelectedId(null)
    setSelectedTextId(null)
    setInspectorMode('canvas')
  }

  const addPoint = (full = false) => {
    if (!videoUrl) return showToast('Upload a video before adding camera points.')
    const inherited = cameraAt(currentTime, points)
    const point: CameraPoint = {
      id: uid(), time: currentTime,
      x: full ? 50 : inherited.x,
      y: full ? 50 : inherited.y,
      zoom: full ? 100 : Math.max(150, inherited.zoom),
      duration: 600, easing: 'smooth', hold: full ? 0 : 1.5,
    }
    const withoutNearby = points.filter(p => p.id === 'full-start' || Math.abs(p.time - currentTime) > 0.06)
    commitPoints([...withoutNearby, point])
    setSelectedId(point.id)
    setSelectedTextId(null)
    setInspectorMode('camera')
    videoRef.current?.pause()
    setIsPlaying(false)
  }

  const updateSelected = (patch: Partial<CameraPoint>, save = true) => {
    if (!selected) return
    commitPoints(points.map(p => {
      if (p.id !== selected.id) return p
      const updated = { ...p, ...patch }
      return { ...updated, ...constrainCamera(updated) }
    }), save)
  }

  const addText = () => {
    if (!selected) return showToast('Select a camera point before adding text.')
    const existing = selected.textOverlays?.[0]
    if (existing) {
      setSelectedTextId(existing.id)
      setInspectorMode('camera')
      return
    }

    const overlay: TextOverlay = {
      id: uid(),
      text: 'Add your message',
      x: 50,
      y: 72,
      fontSize: 32,
      italic: false,
      maxWidth: 70,
    }
    commitPoints(points.map(point => point.id === selected.id
      ? { ...point, textOverlays: [overlay] }
      : point))
    setSelectedTextId(overlay.id)
    setInspectorMode('camera')
    videoRef.current?.pause()
    setIsPlaying(false)
  }

  const updateSelectedText = (patch: Partial<TextOverlay>, save = true) => {
    if (!selected || !selectedText) return
    commitPoints(points.map(point => point.id === selected.id ? {
      ...point,
      textOverlays: (point.textOverlays ?? []).map(overlay => overlay.id === selectedText.id
        ? { ...overlay, ...patch }
        : overlay),
    } : point), save)
  }

  const deleteSelectedText = () => {
    if (!selected || !selectedText) return
    commitPoints(points.map(point => point.id === selected.id ? {
      ...point,
      textOverlays: (point.textOverlays ?? []).filter(overlay => overlay.id !== selectedText.id),
    } : point))
    setSelectedTextId(null)
  }

  const deleteSelected = () => {
    if (!selected || selected.id === 'full-start') return
    commitPoints(points.filter(p => p.id !== selected.id))
    setSelectedId(null)
    setSelectedTextId(null)
  }

  const undo = () => {
    const previous = history.at(-1)
    if (!previous) return
    setFuture(f => [{ points, canvasStyle }, ...f])
    setPoints(previous.points)
    setCanvasStyle(previous.canvasStyle)
    setHistory(h => h.slice(0, -1))
    setSelectedId(null)
    setSelectedTextId(null)
  }

  const redo = () => {
    const next = future[0]
    if (!next) return
    setHistory(h => [...h, { points, canvasStyle }])
    setPoints(next.points)
    setCanvasStyle(next.canvasStyle)
    setFuture(f => f.slice(1))
    setSelectedId(null)
    setSelectedTextId(null)
  }

  const handlePointerDown = (event: React.PointerEvent, kind: 'move' | 'resize') => {
    if (!selected) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedTextId(null)
    setInspectorMode('camera')
    dragRef.current = { kind, startX: event.clientX, startY: event.clientY, point: selected }
    snapshot()
  }

  const handlePointerMove = (event: React.PointerEvent) => {
    const drag = dragRef.current
    const rect = screenRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const dx = ((event.clientX - drag.startX) / rect.width) * 100
    const dy = ((event.clientY - drag.startY) / rect.height) * 100
    if (drag.kind === 'move') {
      const camera = constrainCamera({ ...drag.point, x: drag.point.x + dx, y: drag.point.y + dy })
      setPoints(ps => ps.map(p => p.id === drag.point.id ? { ...p, ...camera } : p))
    } else {
      const sizeDelta = Math.max(dx, dy)
      const oldWidth = 10000 / drag.point.zoom
      const newWidth = Math.max(20, Math.min(400, oldWidth + sizeDelta * 2))
      const camera = constrainCamera({ ...drag.point, zoom: 10000 / newWidth })
      setPoints(ps => ps.map(p => p.id === drag.point.id ? { ...p, ...camera } : p))
    }
  }

  const stopDrag = () => { dragRef.current = null }

  const handleTextPointerDown = (event: React.PointerEvent, pointId: string, overlay: TextOverlay) => {
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    setSelectedId(pointId)
    setSelectedTextId(overlay.id)
    setInspectorMode('camera')
    textDragRef.current = { startX: event.clientX, startY: event.clientY, pointId, overlay }
    snapshot()
  }

  const handleTextPointerMove = (event: React.PointerEvent) => {
    const drag = textDragRef.current
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const x = Math.max(5, Math.min(95, drag.overlay.x + ((event.clientX - drag.startX) / rect.width) * 100))
    const y = Math.max(5, Math.min(95, drag.overlay.y + ((event.clientY - drag.startY) / rect.height) * 100))
    setPoints(current => current.map(point => point.id === drag.pointId ? {
      ...point,
      textOverlays: (point.textOverlays ?? []).map(overlay => overlay.id === drag.overlay.id
        ? { ...overlay, x, y }
        : overlay),
    } : point))
  }

  const stopTextDrag = () => { textDragRef.current = null }

  const jumpPoint = (direction: -1 | 1) => {
    const candidates = direction > 0
      ? sortedPoints.filter(p => p.time > currentTime + 0.01)
      : [...sortedPoints].reverse().filter(p => p.time < currentTime - 0.01)
    if (candidates[0]) { seek(candidates[0].time); setSelectedId(candidates[0].id); setSelectedTextId(null); setInspectorMode('camera') }
  }

  const drawExportFrame = (
    ctx: CanvasRenderingContext2D,
    state: CameraState,
    time: number,
    width: number,
    height: number,
    backgroundCanvas: HTMLCanvasElement | null,
  ) => {
    const video = videoRef.current
    if (!video) return
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, width, height)
    if (backgroundCanvas) ctx.drawImage(backgroundCanvas, 0, 0, width, height)

    const sourceAspect = video.videoWidth / video.videoHeight
    const frame = screenRect(width, height, canvasStyle, sourceAspect)
    const styled = Boolean(activeBackground)
    const resolutionScale = height / 1080
    const radius = styled ? 14 * resolutionScale : 0

    if (styled) {
      ctx.save()
      ctx.shadowColor = 'rgba(0, 0, 0, 0.45)'
      ctx.shadowBlur = 42 * resolutionScale
      ctx.shadowOffsetY = 16 * resolutionScale
      ctx.fillStyle = '#080808'
      roundedRectPath(ctx, frame, radius)
      ctx.fill()
      ctx.restore()
    }

    ctx.save()
    roundedRectPath(ctx, frame, radius)
    ctx.clip()
    ctx.fillStyle = '#080808'
    ctx.fillRect(frame.x, frame.y, frame.width, frame.height)
    const draw = videoRect(sourceAspect, state, frame)
    ctx.drawImage(video, draw.x, draw.y, draw.width, draw.height)
    ctx.restore()
    textPresentationsAt(time, points).forEach(presentation => drawTextPresentation(ctx, presentation, width, height))
  }

  const exportVideo = async () => {
    const video = videoRef.current
    const canvas = exportCanvasRef.current
    if (!video || !canvas || !videoUrl) return showToast('Upload a video before exporting.')
    if (!('MediaRecorder' in window)) return showToast('This browser does not support video export.')
    setIsExporting(true)
    setSelectedId(null)
    setSelectedTextId(null)
    video.pause()
    const width = video.videoWidth || 1920
    const height = video.videoHeight || 1080
    const backgroundPromise = activeBackground
      ? prepareBackgroundCanvas(activeBackground.image, canvasStyle.blur, width, height).catch(() => null)
      : Promise.resolve(null)
    const [, , exportBackground] = await Promise.all([
      document.fonts.load('600 32px Inter'),
      document.fonts.load('italic 600 32px Inter'),
      backgroundPromise,
    ])
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')!
    const stream = canvas.captureStream(30)
    const sourceStream = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream?.()
    sourceStream?.getAudioTracks().forEach(track => stream.addTrack(track))
    const types = ['video/mp4;codecs=h264,aac', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm']
    const mimeType = types.find(type => MediaRecorder.isTypeSupported(type)) ?? ''
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType, videoBitsPerSecond: 12_000_000 } : undefined)
    const chunks: Blob[] = []
    recorder.ondataavailable = e => { if (e.data.size) chunks.push(e.data) }
    const done = new Promise<void>(resolve => { recorder.onstop = () => resolve() })
    recorder.start(1000)
    video.currentTime = 0
    await video.play()
    const render = () => {
      drawExportFrame(ctx, cameraAt(video.currentTime, points), video.currentTime, width, height, exportBackground)
      setExportProgress(video.currentTime / duration)
      if (!video.ended && video.currentTime < duration) requestAnimationFrame(render)
      else recorder.stop()
    }
    requestAnimationFrame(render)
    await done
    video.pause()
    const blob = new Blob(chunks, { type: mimeType || 'video/webm' })
    const extension = mimeType.includes('mp4') ? 'mp4' : 'webm'
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = `${fileName.replace(/\.[^.]+$/, '') || 'frameflow-export'}-directed.${extension}`
    link.click()
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000)
    setIsExporting(false)
    setExportProgress(0)
    showToast(extension === 'mp4' ? 'MP4 export complete.' : 'Export complete as WebM (browser MP4 encoding unavailable).')
  }

  const focusWidth = Math.min(100, 10000 / liveCamera.zoom)
  const focusHeight = Math.min(100, 10000 / liveCamera.zoom)
  const videoTransform = `translate(${(50 - liveCamera.x) * liveCamera.zoom / 100}%, ${(50 - liveCamera.y) * liveCamera.zoom / 100}%) scale(${liveCamera.zoom / 100})`

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark"><Aperture size={18}/></span><span>Frameflow</span></div>
        <div className="project-name"><span className="status-dot"/> {fileName || 'Untitled product demo'} <ChevronDown size={14}/></div>
        <div className="toolbar-actions">
          <button className="icon-button" onClick={undo} disabled={!history.length} title="Undo"><Undo2 size={17}/></button>
          <button className="icon-button" onClick={redo} disabled={!future.length} title="Redo"><Redo2 size={17}/></button>
          <span className="divider"/>
          <button className="button ghost" onClick={() => fileRef.current?.click()}><Upload size={16}/> Upload</button>
          <a className="button ghost" href={sampleVideoUrl} download="Frameflow-sample-video.mp4"><Download size={16}/> Download sample</a>
          <button className="button export" onClick={exportVideo} disabled={isExporting}><Download size={16}/>{isExporting ? `Exporting ${Math.round(exportProgress * 100)}%` : 'Export'}</button>
        </div>
      </header>

      <main className="workspace">
        <section className="stage-area">
          <div className="stage-toolbar">
            <div className="pill-group">
              <button className="stage-action primary" onClick={() => addPoint(false)}><Plus size={16}/> Add focus</button>
              <button className="stage-action" onClick={() => addPoint(true)}><Maximize2 size={15}/> Full view</button>
              <button className="stage-action" onClick={addText} disabled={!selected}><TypeIcon size={15}/> {selected?.textOverlays?.length ? 'Edit text' : 'Add text'}</button>
              <button className={`stage-action ${inspectorMode === 'canvas' ? 'active' : ''}`} onClick={openCanvasInspector} disabled={!videoUrl} aria-pressed={inspectorMode === 'canvas'}><ImageIcon size={15}/> Canvas</button>
            </div>
            <span className="canvas-label">16:9 · Fit</span>
          </div>

          <div className="canvas-wrap">
            <div
              className={`video-canvas ${!videoUrl ? 'empty' : ''}`}
              ref={canvasRef}
              onDoubleClick={() => addPoint(false)}
              onDragOver={e => { e.preventDefault(); e.currentTarget.classList.add('dragging') }}
              onDragLeave={e => e.currentTarget.classList.remove('dragging')}
              onDrop={e => { e.preventDefault(); e.currentTarget.classList.remove('dragging'); loadVideo(e.dataTransfer.files[0]) }}
            >
              {videoUrl ? (
                <>
                  {activeBackground && <div className="scene-background">
                    <img
                      src={activeBackground.image}
                      alt=""
                      draggable={false}
                      style={{
                        filter: canvasStyle.blur > 0 ? `blur(${canvasStyle.blur * previewScale}px)` : 'none',
                        transform: canvasStyle.blur > 0 ? 'scale(1.06)' : 'scale(1)',
                      }}
                    />
                  </div>
                  }
                  <div
                    className={`screen-frame ${activeBackground ? 'styled' : ''}`}
                    ref={screenRef}
                    style={previewFrameStyle}
                  >
                    <div className="video-transform" style={{ transform: videoTransform }}>
                      <video
                        ref={videoRef} src={videoUrl} muted={muted}
                        onLoadedMetadata={e => {
                          setDuration(e.currentTarget.duration)
                          setVideoAspect(e.currentTarget.videoWidth / e.currentTarget.videoHeight || 16 / 9)
                          seek(0)
                        }}
                        onEnded={() => setIsPlaying(false)}
                      />
                    </div>
                    {selected && (
                      <div
                        className="focus-box"
                        style={{ width: `${focusWidth}%`, height: `${focusHeight}%`, left: `${selected.x}%`, top: `${selected.y}%` }}
                        onPointerDown={e => handlePointerDown(e, 'move')}
                        onPointerMove={handlePointerMove}
                        onPointerUp={stopDrag}
                        onPointerCancel={stopDrag}
                      >
                        <span className="focus-tag"><Focus size={12}/> Focus area</span>
                        <span className="grid-v one"/><span className="grid-v two"/>
                        <span className="grid-h one"/><span className="grid-h two"/>
                        <button className="resize-handle" aria-label="Resize focus area"
                          onPointerDown={e => { e.stopPropagation(); handlePointerDown(e, 'resize') }}
                          onPointerMove={handlePointerMove} onPointerUp={stopDrag}/>
                      </div>
                    )}
                  </div>
                  <div className="text-overlay-layer">
                    {previewTexts.map(({ overlay, opacity, translateY, scale }) => {
                      const isEditable = Boolean(selected)
                      const isTextSelected = selectedTextId === overlay.id
                      return <div
                        key={overlay.id}
                        className={`text-overlay ${isEditable ? 'editable' : ''} ${isTextSelected ? 'selected' : ''}`}
                        style={{
                          left: `${overlay.x}%`,
                          top: `${overlay.y}%`,
                          maxWidth: `${effectiveTextWidth(overlay)}%`,
                          fontSize: `${overlay.fontSize * previewScale}px`,
                          padding: `${9 * previewScale}px ${14 * previewScale}px`,
                          borderRadius: `${9 * previewScale}px`,
                          opacity,
                          fontStyle: overlay.italic ? 'italic' : 'normal',
                          transform: `translate(-50%, -50%) translateY(${translateY * previewScale}px) scale(${scale})`,
                        }}
                        onPointerDown={event => selected && handleTextPointerDown(event, selected.id, overlay)}
                        onPointerMove={handleTextPointerMove}
                        onPointerUp={stopTextDrag}
                        onPointerCancel={stopTextDrag}
                        onDoubleClick={event => event.stopPropagation()}
                      >{overlay.text}</div>
                    })}
                  </div>
                </>
              ) : (
                <div className="empty-state">
                  <div className="upload-orbit"><div className="upload-icon"><Film size={30}/></div></div>
                  <h1>Turn screen recordings into<br/>polished product stories.</h1>
                  <p>Drop in an MP4 or MOV, then direct the camera with a few clicks.</p>
                  <button className="button upload-main" onClick={() => fileRef.current?.click()}><Upload size={17}/> Choose video</button>
                  <span>or drag and drop anywhere on the canvas</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <aside className="inspector">
          <div className="inspector-header">
            <div><span className="eyebrow">INSPECTOR</span><h2>{inspectorMode === 'canvas' ? 'Canvas' : selectedText ? 'Text overlay' : selected ? 'Camera point' : 'Camera'}</h2></div>
            {inspectorMode === 'canvas'
              ? <button className="icon-button" onClick={() => setInspectorMode('camera')} title="Close canvas settings"><X size={17}/></button>
              : selectedText
              ? <button className="icon-button" onClick={() => setSelectedTextId(null)} title="Back to camera settings"><X size={17}/></button>
              : selected && selected.id !== 'full-start' && <button className="icon-button" onClick={() => { setSelectedId(null); setSelectedTextId(null) }}><X size={17}/></button>}
          </div>
          {inspectorMode === 'canvas' ? (
            <div className="inspector-content canvas-inspector">
              <div className="selected-time"><span className="point-symbol"><ImageIcon size={14}/></span><div><b>Canvas appearance</b><small>Applies to the entire video</small></div></div>
              <label className="field-label">Background</label>
              <div className="background-grid">
                <button
                  className={`background-option none ${canvasStyle.backgroundId === 'none' ? 'selected' : ''}`}
                  onClick={() => updateCanvasStyle({ backgroundId: 'none' })}
                  aria-label="No background"
                  aria-pressed={canvasStyle.backgroundId === 'none'}
                  title="None"
                ><span>None</span></button>
                {BACKGROUNDS.map(background => <button
                  key={background.id}
                  className={`background-option ${canvasStyle.backgroundId === background.id ? 'selected' : ''}`}
                  onClick={() => updateCanvasStyle({ backgroundId: background.id })}
                  aria-label={`Use ${background.name} background`}
                  aria-pressed={canvasStyle.backgroundId === background.id}
                  title={background.name}
                ><img src={background.thumbnail} alt="" draggable={false}/></button>)}
              </div>
              <div className="section-rule"/>
              <Control label="Padding" value={Math.round(canvasStyle.padding)} suffix="%" min={0} max={16} step={1} disabled={!activeBackground} onChange={value => updateCanvasStyle({ padding: value })}/>
              <div className="canvas-control-gap"/>
              <Control label="Background blur" value={Math.round(canvasStyle.blur)} suffix="px" min={0} max={24} step={1} disabled={!activeBackground} onChange={value => updateCanvasStyle({ blur: value })}/>
              <div className="tip"><HelpCircle size={15}/><span><b>Tip</b> Camera movement stays inside the framed screen while the background remains still.</span></div>
            </div>
          ) : selected && selectedText ? (
            <div className="inspector-content">
              <div className="selected-time"><span className="point-symbol"><TypeIcon size={14}/></span><div><b>Text overlay</b><small>{formatTime(selected.time, true)} camera point</small></div></div>
              <label className="text-content-field">
                <span>Text</span>
                <textarea
                  value={selectedText.text}
                  rows={4}
                  maxLength={280}
                  autoFocus
                  onFocus={snapshot}
                  onChange={event => updateSelectedText({ text: event.target.value }, false)}
                />
                <small>{selectedText.text.length}/280</small>
              </label>
              <div className="section-rule"/>
              <Control label="Font size" value={Math.round(selectedText.fontSize)} suffix="px" min={12} max={72} step={1} onChange={value => updateSelectedText({ fontSize: value })}/>
              <button className={`format-toggle ${selectedText.italic ? 'active' : ''}`} onClick={() => updateSelectedText({ italic: !selectedText.italic })}><Italic size={15}/> Italic</button>
              <div className="section-rule"/>
              <button className="full-reset" onClick={() => setSelectedTextId(null)}><ChevronLeft size={16}/> Camera settings</button>
              <button className="delete-button" onClick={deleteSelectedText}><Trash2 size={16}/> Delete text</button>
              <div className="tip"><HelpCircle size={15}/><span><b>Tip</b> Drag the text directly on the canvas. It appears just after the camera settles.</span></div>
            </div>
          ) : selected ? (
            <div className="inspector-content">
              <div className="selected-time"><span className="point-symbol"><Sparkles size={14}/></span><div><b>Camera point</b><small>{formatTime(selected.time, true)} on timeline</small></div></div>
              <button className="text-add-button" onClick={addText}><TypeIcon size={16}/> {selected.textOverlays?.length ? 'Edit text overlay' : 'Add text overlay'}</button>
              <Control label="Zoom" value={Math.round(selected.zoom)} suffix="%" min={25} max={500} step={1} onChange={v => updateSelected({ zoom: v })}/>
              <div className="zoom-presets">
                {[100, 150, 200, 250].map(z => <button key={z} className={Math.round(selected.zoom) === z ? 'active' : ''} onClick={() => updateSelected({ zoom: z })}>{z}%</button>)}
              </div>
              <div className="section-rule"/>
              <label className="field-label">Motion</label>
              <div className="field-row">
                <NumberField label="Duration" value={selected.duration} suffix="ms" min={0} max={5000} onChange={v => updateSelected({ duration: v })}/>
                <label className="compact-field"><span>Easing</span><select value={selected.easing} onChange={e => updateSelected({ easing: e.target.value as Easing })}><option value="smooth">Smooth</option><option value="snappy">Snappy</option><option value="linear">Linear</option></select></label>
              </div>
              <NumberField label="Hold after point" value={selected.hold} suffix="sec" min={0} max={60} step={0.1} onChange={v => updateSelected({ hold: v })}/>
              <div className="section-rule"/>
              <button className="accordion" onClick={() => setAdvancedOpen(v => !v)}><span>Advanced positioning</span><ChevronDown size={15} className={advancedOpen ? 'open' : ''}/></button>
              {advancedOpen && <div className="field-row advanced"><NumberField label="Position X" value={Math.round(selected.x * 10) / 10} suffix="%" min={0} max={100} step={0.1} onChange={v => updateSelected({ x: v })}/><NumberField label="Position Y" value={Math.round(selected.y * 10) / 10} suffix="%" min={0} max={100} step={0.1} onChange={v => updateSelected({ y: v })}/></div>}
              <button className="full-reset" onClick={() => updateSelected({ ...FULL_VIEW })}><RotateCcw size={16}/> Reset this point to full view</button>
              {selected.id !== 'full-start' && <button className="delete-button" onClick={deleteSelected}><Trash2 size={16}/> Delete camera point</button>}
              <div className="tip"><HelpCircle size={15}/><span><b>Tip</b> Drag and resize the focus area directly on the canvas. These values stay in sync.</span></div>
            </div>
          ) : (
            <div className="inspector-empty">
              <div className="empty-inspector-icon"><Focus size={22}/></div>
              <h3>No camera point selected</h3>
              <p>Select a marker in the timeline, or add a new focus point at the playhead.</p>
              <button className="button inspector-add" onClick={() => addPoint(false)}><Plus size={16}/> Add focus at {formatTime(currentTime, true)}</button>
            </div>
          )}
        </aside>
      </main>

      <section className="timeline-panel">
        <div className="playback-row">
          <div className="transport">
            <button className="icon-button" onClick={() => jumpPoint(-1)}><ChevronLeft size={18}/></button>
            <button className="play-button" onClick={togglePlay}>{isPlaying ? <Pause size={17} fill="currentColor"/> : <Play size={17} fill="currentColor"/>}</button>
            <button className="icon-button" onClick={() => jumpPoint(1)}><ChevronRight size={18}/></button>
            <button className="icon-button" onClick={() => setMuted(v => !v)}>{muted ? <VolumeX size={17}/> : <Volume2 size={17}/>}</button>
            <span className="timecode"><b>{formatTime(currentTime, true)}</b> <i>/</i> {formatTime(duration, true)}</span>
          </div>
          <div className="timeline-title"><Focus size={14}/> CAMERA</div>
          <div className="timeline-zoom">– <input type="range" min="50" max="150" defaultValue="100"/> +</div>
        </div>
        <Timeline duration={duration} currentTime={currentTime} points={sortedPoints} selectedId={selectedId} onSeek={seek} onSelect={id => { const p = points.find(item => item.id === id); if (p) seek(p.time); setSelectedId(id); setSelectedTextId(null); setInspectorMode('camera') }}/>
      </section>

      <input ref={fileRef} hidden type="file" accept="video/mp4,video/quicktime,video/*" onChange={e => loadVideo(e.target.files?.[0])}/>
      <canvas ref={exportCanvasRef} hidden/>
      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}

function Control({ label, value, suffix, min, max, step, disabled = false, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step: number; disabled?: boolean; onChange: (n: number) => void }) {
  return <div className={`control ${disabled ? 'disabled' : ''}`}><div className="control-head"><label>{label}</label><div className="number-box"><input value={value} min={min} max={max} step={step} type="number" disabled={disabled} onChange={e => onChange(Number(e.target.value))}/><span>{suffix}</span></div></div><input className="accent-range" type="range" value={value} min={min} max={max} step={step} disabled={disabled} onChange={e => onChange(Number(e.target.value))}/><div className="range-labels"><span>{min}{suffix}</span><span>{max}{suffix}</span></div></div>
}

function NumberField({ label, value, suffix, min, max, step = 1, onChange }: { label: string; value: number; suffix: string; min: number; max: number; step?: number; onChange: (n: number) => void }) {
  return <label className="compact-field"><span>{label}</span><div><input value={value} min={min} max={max} step={step} type="number" onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}/><i>{suffix}</i></div></label>
}

function Timeline({ duration, currentTime, points, selectedId, onSeek, onSelect }: { duration: number; currentTime: number; points: CameraPoint[]; selectedId: string | null; onSeek: (n: number) => void; onSelect: (id: string) => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const safeDuration = Number.isFinite(duration) && duration > 0 ? duration : 1
  const scrub = (e: React.PointerEvent) => { const rect = ref.current!.getBoundingClientRect(); onSeek(((e.clientX - rect.left) / rect.width) * safeDuration) }
  const ticks = timelineTicks(duration)
  return <div className="timeline-scroll">
    <div className="ruler" ref={ref} onPointerDown={scrub} onPointerMove={e => { if (e.buttons === 1) scrub(e) }}>
      {ticks.map(tick => <div className={`tick ${tick.major ? 'major' : 'minor'}`} key={tick.time} style={{ left: `${(tick.time / safeDuration) * 100}%` }}>{tick.major && <span>{formatTime(tick.time)}</span>}</div>)}
      <div className="camera-track">
        <div className="track-line"/>
        {points.slice(1).map((point, i) => {
          const left = (point.time / safeDuration) * 100
          const transitionWidth = (point.duration / 1000 / safeDuration) * 100
          const holdWidth = (point.hold / safeDuration) * 100
          return <div key={point.id}>
            <div className="transition-region" style={{ left: `${Math.max(0, left-transitionWidth)}%`, width: `${transitionWidth}%` }}/>
            {point.hold > 0 && (
              <div className="hold-region" style={{ left: `${left}%`, width: `${Math.min(100-left, holdWidth)}%` }}/>
            )}
            <button className={`keyframe ${selectedId === point.id ? 'selected' : ''}`} style={{ left: `${left}%` }} onPointerDown={e => e.stopPropagation()} onClick={() => onSelect(point.id)} title={`Camera point ${i+1} at ${formatTime(point.time, true)}${point.textOverlays?.length ? ' with text' : ''}`}>
              <span/>{point.textOverlays?.some(overlay => overlay.text.trim()) && <TypeIcon className="text-indicator" size={10}/>}
            </button>
          </div>
        })}
      </div>
      <div className="playhead" style={{ left: `${(currentTime / safeDuration) * 100}%` }}><span/></div>
    </div>
  </div>
}
