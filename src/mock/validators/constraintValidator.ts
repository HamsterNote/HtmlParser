import { ConstraintConflict, FieldConstraint } from '../types'

const describeRange = (min?: number, max?: number): string => {
  if (min == null && max == null) return 'unbounded'
  if (min == null) return `<= ${max}`
  if (max == null) return `>= ${min}`
  return `${min}..${max}`
}

export const detectConstraintConflicts = (
  fields: FieldConstraint[]
): ConstraintConflict[] => {
  const conflicts: ConstraintConflict[] = []

  fields.forEach((field) => {
    if (field.range && field.range.min != null && field.range.max != null) {
      if (field.range.min > field.range.max) {
        conflicts.push({
          fieldName: field.fieldName,
          reason: 'range',
          details: `range min > max (${describeRange(
            field.range.min,
            field.range.max
          )})`
        })
      }
    }

    if (field.length && field.length.min != null && field.length.max != null) {
      if (field.length.min > field.length.max) {
        conflicts.push({
          fieldName: field.fieldName,
          reason: 'length',
          details: `length min > max (${describeRange(
            field.length.min,
            field.length.max
          )})`
        })
      }
    }

    if (field.allowedValues && field.allowedValues.length === 0) {
      conflicts.push({
        fieldName: field.fieldName,
        reason: 'allowedValues',
        details: 'allowedValues is empty'
      })
    }

    if (field.relations && field.relations.length > 1) {
      const relationTypes = new Set(field.relations.map((r) => r.type))
      if (relationTypes.has('equals') && relationTypes.has('notEquals')) {
        conflicts.push({
          fieldName: field.fieldName,
          reason: 'relations',
          details: 'conflicting relation constraints for equals/notEquals'
        })
      }
    }
  })

  return conflicts
}
