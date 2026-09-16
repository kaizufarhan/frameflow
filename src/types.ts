export type Easing = 'smooth' | 'snappy' | 'linear'

export type BackgroundId =
  | 'none'
  | 'autumnal-peach'
  | 'blossom-2'
  | 'blushing-fire'
  | 'bright-rain'
  | 'floss'
  | 'good-vibes'
  | 'moonrise'
  | 'rose-thorn'

export interface CanvasStyle {
  backgroundId: BackgroundId
  padding: number
  blur: number
}

export interface TextOverlay {
  id: string
  text: string
  x: number
  y: number
  fontSize: number
  italic: boolean
  maxWidth: number
}

export interface CameraPoint {
  id: string
  time: number
  x: number
  y: number
  zoom: number
  duration: number
  easing: Easing
  hold: number
  textOverlays?: TextOverlay[]
}

export interface CameraState {
  x: number
  y: number
  zoom: number
}
