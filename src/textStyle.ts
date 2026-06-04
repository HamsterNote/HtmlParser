import { type IntermediateText, TextDir } from '@hamster-note/types'

import { devConsoleLog } from './devLog.js'
import {
  computeRotationDeg,
  computeTargetHeight,
  computeTargetWidth,
  validatePolygon
} from './textGeometry.js'
import {
  computeScale,
  measureTextBaseline
} from './textMeasurement.js'

export type TextStylePayload = {
  left: number
  top: number
  rotationDeg: number
  scaleX: number
  scaleY: number
  transform: string
  transformOrigin: '0 0'
  fontSize: number
  lineHeight: number
  fontWeight: number
  italic: boolean
  color: string
  fontFamily: string
  dir: TextDir
  writingMode: 'horizontal-tb' | 'vertical-rl'
}

const METRIC_HEIGHT_TOLERANCE = 1
const NORMALIZED_METRIC_LIMIT = 2

const resolveMetricValue = (value: number, fontSize: number): number | null => {
  const absoluteValue = Math.abs(value)
  if (!Number.isFinite(absoluteValue) || absoluteValue <= 0) return null

  // ascent/descent may arrive as normalized font metrics such as 0.89 / -0.21.
  return absoluteValue <= NORMALIZED_METRIC_LIMIT
    ? absoluteValue * fontSize
    : absoluteValue
}

const getNaturalMetricHeights = (text: IntermediateText): number[] => {
  const ascent = resolveMetricValue(text.ascent, text.fontSize)
  const descent = resolveMetricValue(text.descent, text.fontSize)
  if (ascent === null || descent === null) return []

  const unsignedHeight = ascent + descent
  const heights = [unsignedHeight]

  if (text.descent < 0) {
    // Some upstream polygon heights are built from ascent + descent before
    // taking abs(descent), so recognize that signed natural height too.
    heights.push(Math.abs(ascent - descent))
  }

  return heights
}

const isNaturalMetricHeight = (
  text: IntermediateText,
  targetHeight: number
): boolean => {
  return getNaturalMetricHeights(text).some(
    (height) => Math.abs(targetHeight - height) <= METRIC_HEIGHT_TOLERANCE
  )
}

const shouldApplyInferredScale = (
  text: IntermediateText,
  rotationDeg: number,
  scaleX: number,
  scaleY: number,
  targetHeight: number
): boolean => {
  if (text.vertical || text.dir === TextDir.TTB) return false

  if (isNaturalMetricHeight(text, targetHeight)) return false

  const hasMeaningfulVerticalScale = Math.abs(scaleY - 1) > 0.08
  if (hasMeaningfulVerticalScale) return true

  const isPlainHeight = Math.abs(targetHeight - text.lineHeight) <= 1
  const hasMeaningfulRotation = Math.abs(rotationDeg) > 0.1
  const hasMeaningfulHorizontalScale = Math.abs(scaleX - 1) > 0.08

  if (isPlainHeight && hasMeaningfulHorizontalScale && !hasMeaningfulRotation) {
    return false
  }

  return hasMeaningfulRotation && hasMeaningfulVerticalScale
}

export const computeTextStyle = (text: IntermediateText): TextStylePayload => {
  devConsoleLog('[computeTextStyle] 开始计算文本样式', { textId: text.id, content: text.content.slice(0, 30), fontSize: text.fontSize })
  validatePolygon(text.polygon)

  const [anchorX, anchorY] = text.polygon[0]
  devConsoleLog('[computeTextStyle] 锚点', { anchorX, anchorY })

  const rotationDeg = computeRotationDeg(text.polygon)
  const targetWidth = computeTargetWidth(text.polygon)
  const targetHeight = computeTargetHeight(text.polygon)
  devConsoleLog('[computeTextStyle] Polygon 几何信息', { rotationDeg, targetWidth, targetHeight })

  let scaleX = 1
  let scaleY = 1

  try {
    const baseline = measureTextBaseline(
      text.content,
      text.fontSize,
      text.fontFamily,
      text.fontWeight,
      text.italic,
      targetWidth,
      text.lineHeight
    )
    devConsoleLog('[computeTextStyle] 基准测量', baseline)

    const scale = computeScale(
      baseline.width,
      baseline.height,
      targetWidth,
      targetHeight
    )
    scaleX = scale.scaleX
    scaleY = scale.scaleY
    devConsoleLog('[computeTextStyle] 缩放计算', { scaleX, scaleY })
  } catch (error) {
    devConsoleLog('[computeTextStyle] 基准测量失败，回退到无缩放样式', {
      error,
      targetWidth,
      targetHeight
    })
  }

  const applyInferredScale = shouldApplyInferredScale(
    text,
    rotationDeg,
    scaleX,
    scaleY,
    targetHeight
  )
  const resolvedScaleX = applyInferredScale ? scaleX : 1
  const resolvedScaleY = applyInferredScale ? scaleY : 1

  const result: TextStylePayload = {
    left: anchorX,
    top: anchorY,
    rotationDeg,
    scaleX: resolvedScaleX,
    scaleY: resolvedScaleY,
    transform: `rotate(${rotationDeg}deg) scale(${resolvedScaleX}, ${resolvedScaleY})`,
    transformOrigin: '0 0',
    fontSize: text.fontSize,
    lineHeight: text.lineHeight,
    fontWeight: text.fontWeight,
    italic: text.italic,
    color: text.color,
    fontFamily: text.fontFamily,
    dir: text.dir,
    writingMode:
      text.vertical || text.dir === TextDir.TTB ? 'vertical-rl' : 'horizontal-tb'
  }
  devConsoleLog('[computeTextStyle] 样式计算完成', result)
  return result
}
