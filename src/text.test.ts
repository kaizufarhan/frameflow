import { describe, expect, it } from 'vitest'
import { effectiveTextWidth, textPresentationsAt } from './text'
import type { CameraPoint, TextOverlay } from './types'

const overlay: TextOverlay = {
  id: 'text-1',
  text: 'A useful annotation',
  x: 50,
  y: 72,
  fontSize: 32,
  italic: false,
  maxWidth: 70,
}

const points: CameraPoint[] = [
  { id: 'start', time: 0, x: 50, y: 50, zoom: 100, duration: 600, easing: 'smooth', hold: 0 },
  { id: 'focus', time: 2, x: 60, y: 50, zoom: 200, duration: 600, easing: 'smooth', hold: 1, textOverlays: [overlay] },
  { id: 'next', time: 5, x: 50, y: 50, zoom: 100, duration: 1000, easing: 'smooth', hold: 0 },
]

describe('textPresentationsAt', () => {
  it('waits until shortly after the camera reaches its focus point', () => {
    expect(textPresentationsAt(2.07, points)).toEqual([])
    const entering = textPresentationsAt(2.2, points)[0]
    expect(entering.opacity).toBeGreaterThan(0)
    expect(entering.opacity).toBeLessThan(1)
    expect(entering.translateY).toBeGreaterThan(0)
  })

  it('holds the text at full opacity while the focus point is settled', () => {
    const settled = textPresentationsAt(2.5, points)[0]
    expect(settled.opacity).toBe(1)
    expect(settled.translateY).toBe(0)
    expect(settled.scale).toBe(1)
  })

  it('fades out before the next camera transition starts', () => {
    const exiting = textPresentationsAt(3.9, points)[0]
    expect(exiting.opacity).toBeGreaterThan(0)
    expect(exiting.opacity).toBeLessThan(1)
    expect(textPresentationsAt(4.01, points)).toEqual([])
  })

  it('keeps text visible when its point is the final camera point', () => {
    const finalPoints = points.slice(0, 2)
    expect(textPresentationsAt(20, finalPoints)[0].opacity).toBe(1)
  })
})

describe('effectiveTextWidth', () => {
  it('keeps the wrapping width within the output frame near an edge', () => {
    expect(effectiveTextWidth({ ...overlay, x: 10 })).toBe(16)
    expect(effectiveTextWidth(overlay)).toBe(70)
  })
})
