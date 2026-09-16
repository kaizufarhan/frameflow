import { cameraTransitionStart } from './camera'
import type { CameraPoint, TextOverlay } from './types'

export const TEXT_ENTER_DELAY = 0.08
export const TEXT_ENTER_DURATION = 0.24
export const TEXT_EXIT_DURATION = 0.16

export interface TextPresentation {
  overlay: TextOverlay
  opacity: number
  translateY: number
  scale: number
}

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value))
}

function smoothstep(value: number) {
  const n = clamp01(value)
  return n * n * (3 - 2 * n)
}

export function effectiveTextWidth(overlay: TextOverlay) {
  const availableAtPosition = Math.max(10, 2 * Math.min(overlay.x, 100 - overlay.x) - 4)
  return Math.min(overlay.maxWidth, availableAtPosition)
}

export function textPresentationsAt(time: number, points: CameraPoint[]): TextPresentation[] {
  const sorted = [...points].sort((a, b) => a.time - b.time)
  let index = -1

  for (let i = 0; i < sorted.length; i += 1) {
    if (sorted[i].time <= time) index = i
    else break
  }

  if (index < 0) return []
  const point = sorted[index]
  const overlays = point.textOverlays ?? []
  if (!overlays.length) return []

  const enterStart = point.time + TEXT_ENTER_DELAY
  const enterProgress = smoothstep((time - enterStart) / TEXT_ENTER_DURATION)
  let exitProgress = 1

  const next = sorted[index + 1]
  if (next) {
    const transitionStart = cameraTransitionStart(point, next)
    const exitStart = Math.max(point.time, transitionStart - TEXT_EXIT_DURATION)
    exitProgress = 1 - smoothstep((time - exitStart) / Math.max(0.001, transitionStart - exitStart))
  }

  const opacity = Math.min(enterProgress, exitProgress)
  if (opacity <= 0) return []

  return overlays
    .filter(overlay => overlay.text.trim())
    .map(overlay => ({
      overlay,
      opacity,
      translateY: (1 - enterProgress) * 10,
      scale: 0.98 + enterProgress * 0.02,
    }))
}

export function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = []

  for (const paragraph of text.split('\n')) {
    if (!paragraph) {
      lines.push('')
      continue
    }

    const words = paragraph.split(/\s+/)
    let line = ''

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word
      if (ctx.measureText(candidate).width <= maxWidth) {
        line = candidate
        continue
      }

      if (line) lines.push(line)
      if (ctx.measureText(word).width <= maxWidth) {
        line = word
        continue
      }

      let fragment = ''
      for (const character of word) {
        if (fragment && ctx.measureText(fragment + character).width > maxWidth) {
          lines.push(fragment)
          fragment = character
        } else {
          fragment += character
        }
      }
      line = fragment
    }

    lines.push(line)
  }

  return lines.length ? lines : ['']
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + width, y, x + width, y + height, r)
  ctx.arcTo(x + width, y + height, x, y + height, r)
  ctx.arcTo(x, y + height, x, y, r)
  ctx.arcTo(x, y, x + width, y, r)
  ctx.closePath()
}

export function drawTextPresentation(
  ctx: CanvasRenderingContext2D,
  presentation: TextPresentation,
  width: number,
  height: number,
) {
  const { overlay, opacity, translateY, scale } = presentation
  if (!overlay.text.trim() || opacity <= 0) return

  const resolutionScale = height / 1080
  const fontSize = overlay.fontSize * resolutionScale
  const maxWidth = width * effectiveTextWidth(overlay) / 100
  const paddingX = 14 * resolutionScale
  const paddingY = 9 * resolutionScale
  const lineHeight = fontSize * 1.22

  ctx.save()
  ctx.font = `${overlay.italic ? 'italic ' : ''}600 ${fontSize}px Inter, Arial, sans-serif`
  const innerMaxWidth = Math.max(fontSize * 0.75, maxWidth - paddingX * 2)
  const lines = wrapCanvasText(ctx, overlay.text, innerMaxWidth)
  const textWidth = Math.min(
    innerMaxWidth,
    Math.max(...lines.map(line => ctx.measureText(line).width), 1),
  )
  const boxWidth = textWidth + paddingX * 2
  const boxHeight = lines.length * lineHeight + paddingY * 2
  const centerX = width * overlay.x / 100
  const centerY = height * overlay.y / 100 + translateY * resolutionScale

  ctx.globalAlpha = opacity
  ctx.translate(centerX, centerY)
  ctx.scale(scale, scale)
  ctx.shadowColor = 'rgba(0, 0, 0, 0.42)'
  ctx.shadowBlur = 18 * resolutionScale
  ctx.shadowOffsetY = 4 * resolutionScale
  ctx.fillStyle = 'rgba(12, 12, 14, 0.72)'
  roundedRect(ctx, -boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight, 9 * resolutionScale)
  ctx.fill()
  ctx.shadowColor = 'transparent'
  ctx.fillStyle = '#ffffff'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  lines.forEach((line, lineIndex) => {
    const y = -((lines.length - 1) * lineHeight) / 2 + lineIndex * lineHeight
    ctx.fillText(line, 0, y)
  })
  ctx.restore()
}
