import autumnalPeach from './background-images/optimized/autumnal-peach.webp'
import blossom from './background-images/optimized/blossom-2.webp'
import blushingFire from './background-images/optimized/blushing-fire.webp'
import brightRain from './background-images/optimized/bright-rain.webp'
import floss from './background-images/optimized/floss.webp'
import goodVibes from './background-images/optimized/good-vibes.webp'
import moonrise from './background-images/optimized/moonrise.webp'
import roseThorn from './background-images/optimized/rose-thorn.webp'
import autumnalPeachThumb from './background-images/thumbnails/autumnal-peach.webp'
import blossomThumb from './background-images/thumbnails/blossom-2.webp'
import blushingFireThumb from './background-images/thumbnails/blushing-fire.webp'
import brightRainThumb from './background-images/thumbnails/bright-rain.webp'
import flossThumb from './background-images/thumbnails/floss.webp'
import goodVibesThumb from './background-images/thumbnails/good-vibes.webp'
import moonriseThumb from './background-images/thumbnails/moonrise.webp'
import roseThornThumb from './background-images/thumbnails/rose-thorn.webp'
import type { BackgroundId, CanvasStyle } from './types'

export interface BackgroundOption {
  id: Exclude<BackgroundId, 'none'>
  name: string
  image: string
  thumbnail: string
}

export const DEFAULT_CANVAS_STYLE: CanvasStyle = {
  backgroundId: 'none',
  padding: 8,
  blur: 0,
}

export const BACKGROUNDS: BackgroundOption[] = [
  { id: 'autumnal-peach', name: 'Autumnal Peach', image: autumnalPeach, thumbnail: autumnalPeachThumb },
  { id: 'blossom-2', name: 'Blossom', image: blossom, thumbnail: blossomThumb },
  { id: 'blushing-fire', name: 'Blushing Fire', image: blushingFire, thumbnail: blushingFireThumb },
  { id: 'bright-rain', name: 'Bright Rain', image: brightRain, thumbnail: brightRainThumb },
  { id: 'floss', name: 'Floss', image: floss, thumbnail: flossThumb },
  { id: 'good-vibes', name: 'Good Vibes', image: goodVibes, thumbnail: goodVibesThumb },
  { id: 'moonrise', name: 'Moonrise', image: moonrise, thumbnail: moonriseThumb },
  { id: 'rose-thorn', name: 'Rose Thorn', image: roseThorn, thumbnail: roseThornThumb },
]

export function getBackground(id: BackgroundId) {
  return id === 'none' ? null : BACKGROUNDS.find(background => background.id === id) ?? null
}
