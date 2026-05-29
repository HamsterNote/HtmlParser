import type { IntermediateText } from '@hamster-note/types'

/**
 * 允许在 decode 阶段覆盖的 8 个视觉字段。
 * 不接受 content / polygon / geometry / opacity / skew 等结构性字段。
 */
export type DecodeTextControl = Partial<
  Pick<
    IntermediateText,
    | 'fontSize'
    | 'lineHeight'
    | 'fontWeight'
    | 'italic'
    | 'color'
    | 'fontFamily'
    | 'vertical'
    | 'dir'
  >
>

/** 解码选项，包含可选的文本控制覆盖 */
export type DecodeOptions = {
  textControl?: DecodeTextControl
}

/**
 * 白名单字段列表 — 只允许这 8 个视觉属性被覆盖。
 * 使用 readonly 数组配合 as const 以支持类型推导。
 */
export const DECODE_TEXT_CONTROL_FIELDS = [
  'fontSize',
  'lineHeight',
  'fontWeight',
  'italic',
  'color',
  'fontFamily',
  'vertical',
  'dir'
] as const

/**
 * 将未知输入归一化为 DecodeTextControl。
 *
 * - 非对象 / null 输入 → undefined（不抛错）
 * - 只保留白名单内的 **自身** 且 **已定义** 的属性
 * - 所有属性都无效时返回 undefined（no-op）
 */
export function normalizeDecodeTextControl(
  control: unknown
): DecodeTextControl | undefined {
  // 非对象或 null 直接忽略
  if (typeof control !== 'object' || control === null) {
    return undefined
  }

  const source = control as Record<string, unknown>
  const result: Record<string, unknown> = {}
  let hasEffective = false

  for (const field of DECODE_TEXT_CONTROL_FIELDS) {
    // 只接受 own 属性
    if (!Object.prototype.hasOwnProperty.call(source, field)) {
      continue
    }
    // undefined 视为 no-op
    if (source[field] === undefined) {
      continue
    }
    result[field] = source[field]
    hasEffective = true
  }

  return hasEffective ? (result as DecodeTextControl) : undefined
}

/**
 * 将 DecodeTextControl 应用到 IntermediateText 上。
 *
 * - textControl 为 undefined 或无有效字段 → 返回原始 text 引用（reference equality）
 * - 存在有效覆盖 → 返回新的浅拷贝对象（...text, ...overrides）
 * - 永远不修改原始 text
 */
export function applyDecodeTextControl(
  text: IntermediateText,
  textControl: DecodeTextControl | undefined
): IntermediateText {
  if (textControl === undefined) {
    return text
  }

  // 再次过滤：只取白名单内、own、非 undefined 的字段
  const overrides: Record<string, unknown> = {}
  let hasEffective = false

  for (const field of DECODE_TEXT_CONTROL_FIELDS) {
    if (
      Object.prototype.hasOwnProperty.call(textControl, field) &&
      (textControl as Record<string, unknown>)[field] !== undefined
    ) {
      overrides[field] = (textControl as Record<string, unknown>)[field]
      hasEffective = true
    }
  }

  if (!hasEffective) {
    return text
  }

  // 浅拷贝：原始字段 + 覆盖字段
  return { ...text, ...overrides } as IntermediateText
}
