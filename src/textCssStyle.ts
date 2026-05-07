import { TextDir } from '@hamster-note/types'
import type { IntermediateText } from '@hamster-note/types'

import { devConsoleLog } from './devLog.js'
import { computeTextStyle } from './textStyle.js'
import type { TextStylePayload } from './textStyle.js'

export type TextCssStyle = Record<string, string>

const cssPxOrPercent = (val: number): string => {
  if (Math.abs(val) < 1) return `${(val * 100).toFixed(4)}%`
  return `${val}px`
}

const cssFontSize = (val: number): string => {
  if (Math.abs(val) < 1) return `${val}em`
  return `${val}px`
}

export const cssStyleRecordToString = (style: TextCssStyle): string =>
  Object.entries(style)
    .map(([key, value]) => `${key}: ${value}`)
    .join(';')

export const formatTextCssStyle = (
  textStyle: TextStylePayload,
  scale = 1
): TextCssStyle => {
  devConsoleLog('[formatTextCssStyle] 格式化 CSS 样式', { scale, fontSize: textStyle.fontSize, lineHeight: textStyle.lineHeight })
  const result = {
    position: 'absolute',
    left: cssPxOrPercent(textStyle.left * scale),
    top: cssPxOrPercent(textStyle.top * scale),
    'font-size': cssFontSize(textStyle.fontSize * scale),
    'line-height': cssFontSize(textStyle.lineHeight * scale),
    'font-weight': String(textStyle.fontWeight || 400),
    'font-style': textStyle.italic ? 'italic' : 'normal',
    'font-family': textStyle.fontFamily || '',
    color:
      textStyle.color && textStyle.color !== 'transparent'
        ? textStyle.color
        : '',
    direction: textStyle.dir === TextDir.RTL ? 'rtl' : 'ltr',
    'writing-mode': textStyle.writingMode,
    'white-space': 'pre',
    transform: textStyle.transform,
    'transform-origin': textStyle.transformOrigin
  }
  devConsoleLog('[formatTextCssStyle] CSS 样式格式化完成', result)
  return result
}

export const buildTextCssStyle = (
  text: IntermediateText,
  scale = 1
): TextCssStyle => formatTextCssStyle(computeTextStyle(text), scale)

export const buildTextCssStyleString = (
  text: IntermediateText,
  scale = 1
): string => cssStyleRecordToString(buildTextCssStyle(text, scale))
