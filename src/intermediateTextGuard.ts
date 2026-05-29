import type { IntermediateText } from '@hamster-note/types'

type IntermediateTextShape = {
  content?: unknown
  polygon?: unknown
  fontSize?: unknown
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
