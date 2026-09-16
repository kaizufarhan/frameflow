export interface TimelineTick {
  time: number
  major: boolean
}

const MAJOR_STEPS = [
  1, 2, 5, 10, 15, 30,
  60, 120, 300, 600, 900, 1800,
  3600, 7200, 14400, 21600, 43200, 86400,
]

export function timelineMajorStep(duration: number, maxMajorTicks = 12) {
  if (!Number.isFinite(duration) || duration <= 0) return 1
  const minimumStep = duration / Math.max(2, maxMajorTicks)
  return MAJOR_STEPS.find(step => step >= minimumStep)
    ?? Math.ceil(minimumStep / 86400) * 86400
}

export function timelineTicks(duration: number, maxMajorTicks = 12): TimelineTick[] {
  if (!Number.isFinite(duration) || duration <= 0) return [{ time: 0, major: true }]
  const majorStep = timelineMajorStep(duration, maxMajorTicks)
  const subdivisions = majorStep <= 2 ? 4 : 5
  const minorStep = majorStep / subdivisions
  const count = Math.min(200, Math.floor(duration / minorStep) + 1)
  return Array.from({ length: count }, (_, index) => ({
    time: index * minorStep,
    major: index % subdivisions === 0,
  }))
}
