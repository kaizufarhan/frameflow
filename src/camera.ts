import type { CameraPoint, CameraState, Easing } from './types'

export const FULL_VIEW: CameraState = { x: 50, y: 50, zoom: 100 }

/**
 * Keeps the source frame inside the output canvas when zoomed out, and keeps
 * the output canvas covered by the source when zoomed in. At 100% the only
 * non-cropping position is the exact center.
 */
export function constrainCamera(state: CameraState): CameraState {
  const zoom = Math.max(25, Math.min(500, state.zoom))
  const scale = zoom / 100
  const maxOffset = 50 * Math.abs(1 - 1 / scale)
  const min = Math.max(0, 50 - maxOffset)
  const max = Math.min(100, 50 + maxOffset)

  return {
    zoom,
    x: Math.max(min, Math.min(max, state.x)),
    y: Math.max(min, Math.min(max, state.y)),
  }
}

export function ease(t: number, preset: Easing) {
  const n = Math.max(0, Math.min(1, t))
  if (preset === 'linear') return n
  if (preset === 'snappy') return 1 - Math.pow(1 - n, 4)
  return n < 0.5 ? 4 * n * n * n : 1 - Math.pow(-2 * n + 2, 3) / 2
}

export function cameraTransitionStart(from: CameraPoint, to: CameraPoint) {
  return Math.max(from.time + from.hold, to.time - to.duration / 1000)
}

export function cameraAt(time: number, points: CameraPoint[]): CameraState {
  const sorted = [...points].sort((a, b) => a.time - b.time)
  if (!sorted.length || time <= sorted[0].time) return constrainCamera(sorted[0] ?? FULL_VIEW)

  const nextIndex = sorted.findIndex(point => point.time > time)
  if (nextIndex === -1) return constrainCamera(sorted[sorted.length - 1])

  const from = sorted[nextIndex - 1]
  const to = sorted[nextIndex]
  const transitionStart = cameraTransitionStart(from, to)
  if (time <= transitionStart) return constrainCamera(from)

  const progress = ease((time - transitionStart) / Math.max(0.001, to.time - transitionStart), to.easing)
  return constrainCamera({
    x: from.x + (to.x - from.x) * progress,
    y: from.y + (to.y - from.y) * progress,
    zoom: from.zoom + (to.zoom - from.zoom) * progress,
  })
}

export function formatTime(seconds: number, precise = false) {
  if (!Number.isFinite(seconds)) return '00:00'
  const totalMinutes = Math.floor(seconds / 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = hours > 0 ? totalMinutes % 60 : totalMinutes
  const secs = Math.floor(seconds % 60)
  const clock = `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  const base = hours > 0 ? `${String(hours).padStart(2, '0')}:${clock}` : clock
  return precise ? `${base}.${Math.floor((seconds % 1) * 10 + 1e-6)}` : base
}
