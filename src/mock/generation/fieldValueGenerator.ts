import { FieldConstraint } from '../types'
import { Prng } from './prng'

const alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'
const BASE_DATE_MS = 0 // Fixed epoch for deterministic date generation

const buildString = (length: number, prng: Prng): string => {
  const size = Math.max(1, length)
  let result = ''
  for (let i = 0; i < size; i += 1) {
    result += alphabet[prng.nextInt(0, alphabet.length - 1)]
  }
  return result
}

const resolveNumberRange = (
  field: FieldConstraint
): { min: number; max: number } => {
  const min = field.range?.min ?? 0
  const max = field.range?.max ?? Math.max(min + 10, 100)
  return { min, max }
}

const resolveStringLength = (
  field: FieldConstraint
): { min: number; max: number } => {
  const min = field.length?.min ?? 1
  const max = field.length?.max ?? Math.max(min + 3, 12)
  return { min, max }
}

export const generateNormalValue = (
  field: FieldConstraint,
  prng: Prng
): unknown => {
  if (field.allowedValues && field.allowedValues.length > 0) {
    return prng.pick(field.allowedValues)
  }

  switch (field.type) {
    case 'string': {
      const { min, max } = resolveStringLength(field)
      return buildString(prng.nextInt(min, max), prng)
    }
    case 'number': {
      const { min, max } = resolveNumberRange(field)
      return prng.nextInt(Math.round(min), Math.round(max))
    }
    case 'boolean':
      return prng.nextInt(0, 1) === 1
    case 'date': {
      const base = BASE_DATE_MS
      const offsetDays = prng.nextInt(0, 30)
      return new Date(base + offsetDays * 24 * 60 * 60 * 1000).toISOString()
    }
    case 'enum':
      return field.allowedValues?.[0] ?? 'enum'
    case 'object':
      return {}
    case 'array':
      return []
    default:
      return null
  }
}

export const getBoundaryValues = (
  field: FieldConstraint,
  prng: Prng
): unknown[] => {
  if (field.boundaryValues && field.boundaryValues.length > 0) {
    return field.boundaryValues
  }

  switch (field.type) {
    case 'string': {
      const { min, max } = resolveStringLength(field)
      return [buildString(min, prng), buildString(max, prng)]
    }
    case 'number': {
      const { min, max } = resolveNumberRange(field)
      return [min, max]
    }
    case 'boolean':
      return [true, false]
    case 'date':
      return [
        new Date(BASE_DATE_MS).toISOString(),
        new Date(BASE_DATE_MS + 30 * 24 * 60 * 60 * 1000).toISOString()
      ]
    default:
      return []
  }
}

export const getExceptionValues = (field: FieldConstraint): unknown[] => {
  if (field.exceptionValues && field.exceptionValues.length > 0) {
    return field.exceptionValues
  }

  const exceptions: unknown[] = []
  if (!field.nullable) {
    exceptions.push(null)
  }

  if (field.type === 'number' && field.range) {
    if (field.range.min != null) exceptions.push(field.range.min - 1)
    if (field.range.max != null) exceptions.push(field.range.max + 1)
  }

  if (field.type === 'string' && field.length?.min != null) {
    if (field.length.min > 0) exceptions.push('')
  }

  return exceptions
}
