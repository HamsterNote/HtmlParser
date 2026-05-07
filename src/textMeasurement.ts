import {
  layout,
  measureNaturalWidth,
  prepareWithSegments
} from '@chenglou/pretext'
import { devConsoleLog } from './devLog.js'

export interface TextBaselineMeasurement {
  width: number
  height: number
}

export interface PretextAdapter {
  measure(
    text: string,
    font: string,
    maxWidth: number,
    lineHeight: number
  ): TextBaselineMeasurement
}

const DEFAULT_FONT_FAMILY = 'sans-serif'

const buildFontString = (
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
  italic: boolean
): string => {
  const normalizedFontFamily = fontFamily.trim() || DEFAULT_FONT_FAMILY
  const style = italic ? 'italic ' : ''
  const weight = fontWeight || 400
  return `${style}${weight} ${fontSize}px ${normalizedFontFamily}`
}

class DefaultPretextAdapter implements PretextAdapter {
  measure(
    text: string,
    font: string,
    maxWidth: number,
    lineHeight: number
  ): TextBaselineMeasurement {
    devConsoleLog('[pretext] 开始测量', { text: text.slice(0, 40), font, maxWidth, lineHeight })
    const prepared = prepareWithSegments(text, font, { whiteSpace: 'pre-wrap' })
    const { height } = layout(prepared, maxWidth, lineHeight)
    const width = measureNaturalWidth(prepared)
    devConsoleLog('[pretext] 测量完成', { width, height })
    return { width, height }
  }
}

let pretextAdapter: PretextAdapter = new DefaultPretextAdapter()

export const setPretextAdapter = (adapter: PretextAdapter): void => {
  pretextAdapter = adapter
}

export const resetPretextAdapter = (): void => {
  pretextAdapter = new DefaultPretextAdapter()
}

export const measureTextBaseline = (
  text: string,
  fontSize: number,
  fontFamily: string,
  fontWeight: number,
  italic: boolean,
  maxWidth: number,
  lineHeight: number
): TextBaselineMeasurement => {
  devConsoleLog('[measureTextBaseline] 调用 pretext adapter', { text: text.slice(0, 40), fontSize, fontFamily, fontWeight, italic, maxWidth, lineHeight })
  const font = buildFontString(fontSize, fontFamily, fontWeight, italic)
  const result = pretextAdapter.measure(text, font, maxWidth, lineHeight)
  devConsoleLog('[measureTextBaseline] 返回结果', result)
  return result
}

export const computeScale = (
  baselineWidth: number,
  baselineHeight: number,
  targetWidth: number,
  targetHeight: number
): { scaleX: number; scaleY: number } => {
  devConsoleLog('[computeScale] 计算缩放', { baselineWidth, baselineHeight, targetWidth, targetHeight })
  if (baselineWidth === 0) {
    throw new Error('Baseline width cannot be zero')
  }
  if (baselineWidth < 0) {
    throw new Error('Baseline width must be greater than zero')
  }
  if (baselineHeight === 0) {
    throw new Error('Baseline height cannot be zero')
  }
  if (baselineHeight < 0) {
    throw new Error('Baseline height must be greater than zero')
  }

  const result = {
    scaleX: targetWidth / baselineWidth,
    scaleY: targetHeight / baselineHeight
  }
  devConsoleLog('[computeScale] 缩放结果', result)
  return result
}
