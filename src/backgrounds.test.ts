import { describe, expect, it } from 'vitest'
import { BACKGROUNDS, getBackground } from './backgrounds'

describe('background registry', () => {
  it('contains all eight supplied backgrounds with stable unique IDs', () => {
    expect(BACKGROUNDS).toHaveLength(8)
    expect(new Set(BACKGROUNDS.map(background => background.id)).size).toBe(8)
  })

  it('resolves known backgrounds and treats none as full bleed', () => {
    expect(getBackground('moonrise')?.name).toBe('Moonrise')
    expect(getBackground('none')).toBeNull()
  })
})
