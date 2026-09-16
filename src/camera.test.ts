import { describe, expect, it } from 'vitest'
import { cameraAt, cameraTransitionStart, formatTime, FULL_VIEW } from './camera'
import type { CameraPoint } from './types'

const start: CameraPoint = {
  id: 'start', time: 0, x: 50, y: 50, zoom: 100,
  duration: 600, easing: 'smooth', hold: 1,
}
const focus: CameraPoint = {
  id: 'focus', time: 3, x: 60, y: 40, zoom: 200,
  duration: 1000, easing: 'linear', hold: 1,
}

describe('camera timing', () => {
  it('keeps the established transition-start calculation', () => {
    expect(cameraTransitionStart(start, focus)).toBe(2)
  })

  it('holds the previous camera and then interpolates to the focus point', () => {
    expect(cameraAt(2, [start, focus])).toEqual(FULL_VIEW)
    expect(cameraAt(2.5, [start, focus])).toEqual({ x: 55, y: 45, zoom: 150 })
    expect(cameraAt(3, [start, focus])).toEqual({ x: 60, y: 40, zoom: 200 })
  })
})

describe('formatTime', () => {
  it('adds an hours segment for long recordings', () => {
    expect(formatTime(79 * 60 + 8)).toBe('01:19:08')
    expect(formatTime(79 * 60 + 8.4, true)).toBe('01:19:08.4')
  })
})
