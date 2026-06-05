import type { IntermediateImage, IntermediateText } from '@hamster-note/types'

type IntermediateTextShape = {
  content?: unknown
  polygon?: unknown
  fontSize?: unknown
}

type IntermediateImageShape = {
  src?: unknown
  polygon?: unknown
  opacity?: unknown
}

export function isIntermediateTextLike(value: unknown): value is IntermediateText {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const text = value as IntermediateTextShape
  return (
    typeof text.content === 'string' &&
    Array.isArray(text.polygon) &&
    typeof text.fontSize === 'number'
  )
}

export function isIntermediateImageLike(value: unknown): value is IntermediateImage {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const img = value as IntermediateImageShape
  return (
    typeof img.src === 'string' &&
    Array.isArray(img.polygon) &&
    typeof img.opacity === 'number'
  )
}
