import { TextDir, type IntermediateText } from '@hamster-note/types'

import {
  applyDecodeTextControl,
  DECODE_TEXT_CONTROL_FIELDS,
  normalizeDecodeTextControl,
  type DecodeTextControl
} from '../decodeTextControl.js'

/**
 * 构造一个完整的 IntermediateText 测试对象。
 * 字段值经过精心选择，便于验证覆盖行为。
 */
const buildBaseText = (): IntermediateText =>
  ({
    id: 'text-1',
    content: 'Hello decode',
    fontSize: 16,
    fontFamily: 'Inter',
    fontWeight: 400,
    italic: false,
    color: '#111111',
    polygon: [
      [10, 20],
      [110, 20],
      [110, 40],
      [10, 40]
    ],
    lineHeight: 20,
    ascent: 12,
    descent: 4,
    vertical: false,
    dir: TextDir.LTR,
    opacity: 1,
    skew: 0,
    isEOL: true
  }) as IntermediateText

// ---------------------------------------------------------------------------
// DECODE_TEXT_CONTROL_FIELDS 常量
// ---------------------------------------------------------------------------

describe('DECODE_TEXT_CONTROL_FIELDS', () => {
  it('包含且仅包含 8 个白名单字段', () => {
    expect(DECODE_TEXT_CONTROL_FIELDS).toEqual([
      'fontSize',
      'lineHeight',
      'fontWeight',
      'italic',
      'color',
      'fontFamily',
      'vertical',
      'dir'
    ])
  })

  it('长度为 8', () => {
    expect(DECODE_TEXT_CONTROL_FIELDS).toHaveLength(8)
  })
})

// ---------------------------------------------------------------------------
// normalizeDecodeTextControl
// ---------------------------------------------------------------------------

describe('normalizeDecodeTextControl', () => {
  // 1. undefined / null / 非对象输入
  it('undefined 输入返回 undefined', () => {
    expect(normalizeDecodeTextControl(undefined)).toBeUndefined()
  })

  it('null 输入返回 undefined', () => {
    expect(normalizeDecodeTextControl(null)).toBeUndefined()
  })

  it('原始类型（string / number / boolean）返回 undefined', () => {
    expect(normalizeDecodeTextControl('fontSize')).toBeUndefined()
    expect(normalizeDecodeTextControl(42)).toBeUndefined()
    expect(normalizeDecodeTextControl(true)).toBeUndefined()
  })

  // 2. 空对象 / 全 undefined → no-op
  it('{} 返回 undefined（no-op）', () => {
    expect(normalizeDecodeTextControl({})).toBeUndefined()
  })

  it('{ color: undefined } 返回 undefined（no-op）', () => {
    expect(normalizeDecodeTextControl({ color: undefined })).toBeUndefined()
  })

  // 3. 非白名单 key 被忽略
  it('非白名单 key（content, polygon, x, width, thumbnail, arbitraryKey）被忽略', () => {
    const input = {
      content: 'malicious',
      polygon: [],
      x: 100,
      width: 200,
      thumbnail: 'img.png',
      arbitraryKey: 'nope'
    } as unknown as DecodeTextControl
    expect(normalizeDecodeTextControl(input)).toBeUndefined()
  })

  // 4. 白名单字段逐个测试
  it.each(DECODE_TEXT_CONTROL_FIELDS)('单字段 "%s" 被保留', (field) => {
    const value =
      field === 'italic' || field === 'vertical'
        ? true
        : field === 'fontWeight'
          ? 700
          : field === 'fontSize' || field === 'lineHeight'
            ? 24
            : 'override'
    const result = normalizeDecodeTextControl({ [field]: value })
    expect(result).toEqual({ [field]: value })
  })

  // 5. 混合：白名单 + 非白名单 + undefined
  it('混合输入：只保留有效的白名单字段', () => {
    const result = normalizeDecodeTextControl({
      fontSize: 20,
      content: 'should-be-ignored',
      polygon: [],
      color: undefined,
      fontWeight: 700,
      arbitraryKey: 'nope'
    } as unknown as DecodeTextControl)
    expect(result).toEqual({ fontSize: 20, fontWeight: 700 })
  })

  // 6. italic: false 和 vertical: false 作为有效覆盖
  it('italic: false 是有效覆盖（非 undefined）', () => {
    const result = normalizeDecodeTextControl({ italic: false })
    expect(result).toEqual({ italic: false })
  })

  it('vertical: false 是有效覆盖（非 undefined）', () => {
    const result = normalizeDecodeTextControl({ vertical: false })
    expect(result).toEqual({ vertical: false })
  })

  // 7. 全部 8 个字段同时设置
  it('全部 8 个字段同时设置均被保留', () => {
    const full: DecodeTextControl = {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: 700,
      italic: true,
      color: '#ff0000',
      fontFamily: 'Arial',
      vertical: true,
      dir: TextDir.RTL
    }
    expect(normalizeDecodeTextControl(full)).toEqual(full)
  })
})

// ---------------------------------------------------------------------------
// applyDecodeTextControl
// ---------------------------------------------------------------------------

describe('applyDecodeTextControl', () => {
  // 1. textControl 为 undefined → 返回原始引用
  it('textControl 为 undefined 返回原始 text 引用', () => {
    const text = buildBaseText()
    const result = applyDecodeTextControl(text, undefined)
    expect(result).toBe(text) // reference equality
  })

  // 2. normalize 返回 undefined 时也返回原始引用
  it('normalize 返回 undefined 时返回原始引用', () => {
    const text = buildBaseText()
    const normalized = normalizeDecodeTextControl({})
    const result = applyDecodeTextControl(text, normalized)
    expect(result).toBe(text)
  })

  // 3. 有效覆盖 → 返回新对象（浅拷贝）
  it('有效覆盖返回新的浅拷贝对象', () => {
    const text = buildBaseText()
    const control: DecodeTextControl = { fontSize: 24 }
    const result = applyDecodeTextControl(text, control)
    expect(result).not.toBe(text) // 新对象
    expect(result.fontSize).toBe(24)
    // 其他字段保持不变
    expect(result.fontFamily).toBe('Inter')
    expect(result.content).toBe('Hello decode')
  })

  // 4. 逐字段覆盖测试
  it.each(DECODE_TEXT_CONTROL_FIELDS)('覆盖字段 "%s"', (field) => {
    const text = buildBaseText()
    const value =
      field === 'italic'
        ? true // 原始是 false
        : field === 'vertical'
          ? true // 原始是 false
          : field === 'fontWeight'
            ? 700
            : field === 'fontSize' || field === 'lineHeight'
              ? 99
              : field === 'dir'
                ? TextDir.RTL
                : 'overridden'
    const result = applyDecodeTextControl(text, { [field]: value })
    expect(result).not.toBe(text)
    expect((result as unknown as Record<string, unknown>)[field]).toBe(value)
  })

  // 5. italic: false 覆盖 truthy 原始值
  it('italic: false 覆盖 truthy 原始值', () => {
    const text = { ...buildBaseText(), italic: true } as IntermediateText
    const result = applyDecodeTextControl(text, { italic: false })
    expect(result.italic).toBe(false)
    expect(result).not.toBe(text)
  })

  // 6. vertical: false 覆盖 truthy 原始值
  it('vertical: false 覆盖 truthy 原始值', () => {
    const text = { ...buildBaseText(), vertical: true } as IntermediateText
    const result = applyDecodeTextControl(text, { vertical: false })
    expect(result.vertical).toBe(false)
    expect(result).not.toBe(text)
  })

  // 7. 多字段同时覆盖
  it('多字段同时覆盖', () => {
    const text = buildBaseText()
    const control: DecodeTextControl = {
      fontSize: 32,
      color: '#ff0000',
      fontWeight: 700
    }
    const result = applyDecodeTextControl(text, control)
    expect(result.fontSize).toBe(32)
    expect(result.color).toBe('#ff0000')
    expect(result.fontWeight).toBe(700)
    // 未覆盖的字段保持原值
    expect(result.fontFamily).toBe('Inter')
    expect(result.lineHeight).toBe(20)
  })

  // 8. 原始 text 对象不被修改（不可变性）
  it('原始 text 对象在覆盖后保持不变', () => {
    const text = buildBaseText()
    const originalSnapshot = { ...text }

    applyDecodeTextControl(text, {
      fontSize: 999,
      color: '#000000',
      fontWeight: 900,
      italic: true,
      vertical: true,
      fontFamily: 'Mono',
      lineHeight: 50,
      dir: TextDir.RTL
    })

    // 逐字段断言原始对象未被修改
    expect(text.fontSize).toBe(originalSnapshot.fontSize)
    expect(text.color).toBe(originalSnapshot.color)
    expect(text.fontWeight).toBe(originalSnapshot.fontWeight)
    expect(text.italic).toBe(originalSnapshot.italic)
    expect(text.vertical).toBe(originalSnapshot.vertical)
    expect(text.fontFamily).toBe(originalSnapshot.fontFamily)
    expect(text.lineHeight).toBe(originalSnapshot.lineHeight)
    expect(text.dir).toBe(originalSnapshot.dir)
    expect(text.content).toBe(originalSnapshot.content)
    expect(text.id).toBe(originalSnapshot.id)
  })

  // 9. 非白名单 key 在 textControl 中被忽略（不传入结果）
  it('非白名单 key 不出现在结果中', () => {
    const text = buildBaseText()
    const control = {
      fontSize: 20,
      content: 'should-not-override',
      polygon: [],
      x: 100,
      width: 200,
      thumbnail: 'img.png',
      arbitraryKey: 'nope'
    } as unknown as DecodeTextControl
    const result = applyDecodeTextControl(text, control)
    // fontSize 覆盖生效
    expect(result.fontSize).toBe(20)
    // content 等非白名单字段保持原始值
    expect(result.content).toBe('Hello decode')
    expect(result.polygon).toBe(text.polygon)
  })

  // 10. applyDecodeTextControl + normalize 端到端
  it('normalize + apply 端到端：有效输入产生覆盖', () => {
    const text = buildBaseText()
    const normalized = normalizeDecodeTextControl({ fontSize: 40, fontWeight: 800 })
    const result = applyDecodeTextControl(text, normalized)
    expect(result.fontSize).toBe(40)
    expect(result.fontWeight).toBe(800)
    expect(result).not.toBe(text)
  })

  it('normalize + apply 端到端：无效输入返回原始引用', () => {
    const text = buildBaseText()
    const normalized = normalizeDecodeTextControl({ content: 'ignored', x: 1 })
    const result = applyDecodeTextControl(text, normalized)
    expect(result).toBe(text)
  })
})
