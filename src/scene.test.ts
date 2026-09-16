import { describe, expect, it } from 'vitest'
import { containRect, coverRect, screenRect, videoRect } from './scene'
import type { CanvasStyle } from './types'

const styled: CanvasStyle = { backgroundId: 'moonrise', padding: 8, blur: 0 }

function expectRect(actual: { x: number; y: number; width: number; height: number }, expected: { x: number; y: number; width: number; height: number }) {
  expect(actual.x).toBeCloseTo(expected.x)
  expect(actual.y).toBeCloseTo(expected.y)
  expect(actual.width).toBeCloseTo(expected.width)
  expect(actual.height).toBeCloseTo(expected.height)
}

describe('screenRect', () => {
  it('returns the full canvas when no background is selected', () => {
    expect(screenRect(1920, 1080, { ...styled, backgroundId: 'none' }, 2)).toEqual({ x: 0, y: 0, width: 1920, height: 1080 })
  })

  it('applies proportional padding while preserving aspect ratio', () => {
    expectRect(screenRect(1920, 1080, styled), { x: 153.6, y: 86.4, width: 1612.8, height: 907.2 })
  })

  it('fits a wide source inside the padding without letterboxing the screen frame', () => {
    expectRect(screenRect(1920, 1080, styled, 2), { x: 153.6, y: 136.8, width: 1612.8, height: 806.4 })
  })

  it('fits a tall source inside the padding without cropping', () => {
    expectRect(screenRect(1920, 1080, styled, 4 / 3), { x: 355.2, y: 86.4, width: 1209.6, height: 907.2 })
  })
})

describe('containRect', () => {
  it('centers the supplied aspect ratio inside the target rectangle', () => {
    expectRect(containRect(2, { x: 10, y: 20, width: 160, height: 100 }), { x: 10, y: 30, width: 160, height: 80 })
  })
})

describe('coverRect', () => {
  it('covers the target without stretching the source', () => {
    expect(coverRect(1000, 1000, { x: 0, y: 0, width: 1600, height: 900 })).toEqual({ x: 0, y: -350, width: 1600, height: 1600 })
  })
})

describe('videoRect', () => {
  it('calculates camera motion inside the supplied screen rectangle', () => {
    expectRect(
      videoRect(16 / 9, { x: 50, y: 50, zoom: 100 }, screenRect(1920, 1080, styled)),
      { x: 153.6, y: 86.4, width: 1612.8, height: 907.2 },
    )
    expectRect(
      videoRect(16 / 9, { x: 60, y: 40, zoom: 200 }, screenRect(1920, 1080, styled)),
      { x: -975.36, y: -185.76, width: 3225.6, height: 1814.4 },
    )
  })
})
