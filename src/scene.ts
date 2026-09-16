import type { CameraState, CanvasStyle } from './types'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export function containRect(sourceAspect: number, target: Rect): Rect {
  if (!Number.isFinite(sourceAspect) || sourceAspect <= 0) return target
  const targetAspect = target.width / target.height
  if (sourceAspect > targetAspect) {
    const height = target.width / sourceAspect
    return { x: target.x, y: target.y + (target.height - height) / 2, width: target.width, height }
  }
  const width = target.height * sourceAspect
  return { x: target.x + (target.width - width) / 2, y: target.y, width, height: target.height }
}

export function screenRect(width: number, height: number, style: CanvasStyle, sourceAspect?: number): Rect {
  if (style.backgroundId === 'none') return { x: 0, y: 0, width, height }
  const padding = Math.max(0, Math.min(16, style.padding)) / 100
  const padded = {
    x: width * padding,
    y: height * padding,
    width: width * (1 - padding * 2),
    height: height * (1 - padding * 2),
  }
  return sourceAspect === undefined ? padded : containRect(sourceAspect, padded)
}

export function coverRect(sourceWidth: number, sourceHeight: number, target: Rect): Rect {
  const scale = Math.max(target.width / sourceWidth, target.height / sourceHeight)
  const width = sourceWidth * scale
  const height = sourceHeight * scale
  return {
    x: target.x + (target.width - width) / 2,
    y: target.y + (target.height - height) / 2,
    width,
    height,
  }
}

export function videoRect(sourceAspect: number, state: CameraState, target: Rect): Rect {
  const targetAspect = target.width / target.height
  let baseWidth = target.width
  let baseHeight = target.height
  if (sourceAspect > targetAspect) baseHeight = target.width / sourceAspect
  else baseWidth = target.height * sourceAspect

  const scale = state.zoom / 100
  const width = baseWidth * scale
  const height = baseHeight * scale
  const centerX = target.x + target.width / 2 - ((state.x - 50) / 100) * width
  const centerY = target.y + target.height / 2 - ((state.y - 50) / 100) * height
  return { x: centerX - width / 2, y: centerY - height / 2, width, height }
}

export function roundedRectPath(ctx: CanvasRenderingContext2D, rect: Rect, radius: number) {
  const r = Math.min(radius, rect.width / 2, rect.height / 2)
  ctx.beginPath()
  ctx.moveTo(rect.x + r, rect.y)
  ctx.arcTo(rect.x + rect.width, rect.y, rect.x + rect.width, rect.y + rect.height, r)
  ctx.arcTo(rect.x + rect.width, rect.y + rect.height, rect.x, rect.y + rect.height, r)
  ctx.arcTo(rect.x, rect.y + rect.height, rect.x, rect.y, r)
  ctx.arcTo(rect.x, rect.y, rect.x + rect.width, rect.y, r)
  ctx.closePath()
}

export async function loadImage(src: string) {
  const image = new Image()
  image.decoding = 'async'
  image.src = src
  await image.decode()
  return image
}

export async function prepareBackgroundCanvas(src: string, blur: number, width: number, height: number) {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')!
  const scaledBlur = Math.max(0, blur) * height / 1080
  const bleed = scaledBlur * 2
  const target = { x: -bleed, y: -bleed, width: width + bleed * 2, height: height + bleed * 2 }
  const draw = coverRect(image.naturalWidth, image.naturalHeight, target)
  ctx.filter = scaledBlur > 0 ? `blur(${scaledBlur}px)` : 'none'
  ctx.drawImage(image, draw.x, draw.y, draw.width, draw.height)
  ctx.filter = 'none'
  return canvas
}
