import { describe, expect, it } from 'vitest'
import { timelineMajorStep, timelineTicks } from './timeline'

describe('timeline ruler', () => {
  it('keeps one-second labels for short clips', () => {
    expect(timelineMajorStep(12)).toBe(1)
    expect(timelineTicks(12).filter(tick => tick.major).map(tick => tick.time)).toEqual(
      Array.from({ length: 13 }, (_, index) => index),
    )
  })

  it('uses ten-minute labels for a long recording', () => {
    expect(timelineMajorStep(79 * 60)).toBe(600)
    expect(timelineTicks(79 * 60).filter(tick => tick.major).map(tick => tick.time)).toEqual([
      0, 600, 1200, 1800, 2400, 3000, 3600, 4200,
    ])
  })

  it('stays safe when video metadata has no finite duration', () => {
    expect(timelineTicks(Infinity)).toEqual([{ time: 0, major: true }])
  })
})
