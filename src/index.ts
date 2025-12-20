/**
 * HtmlParser
 * --------------------------------------
 * 本文件实现了 HTML 到中间结构（IntermediateDocument）的解析（encode），
 * 以及从中间结构回写为 HTML 片段或单文件 HTML（decode / decodeToHtml）。
 *
 * 设计要点：
 * - 统一的静态方法 API：encode(fileOrBuffer), decode(doc), decodeToHtml(doc)
 * - encode：读取 HTML 文本，使用 DOMParser（在浏览器环境下）做极简提取，
 *   仅采集文本节点与少量字体样式，推断一个粗略布局（x/y/width/height）。
 * - decodeToHtml：把中间结构的文本恢复为可渲染的 HTML 片段（不含 <html>/<body>）。
 * - decode：在 decodeToHtml 的基础上，拼装成可独立打开的单文件 HTML。
 *
 * 注意：本解析器偏"轻量/近似"，并非完整/严格的 HTML 布局渲染。
 */
import { DocumentParser } from '@hamster-note/document-parser'
import { IntermediateDocument } from '@hamster-note/types'
import { IntermediatePageMap } from '@hamster-note/types'
import { IntermediatePage } from '@hamster-note/types'
import { IntermediateText, TextDir } from '@hamster-note/types'
import { HtmlDocument } from './HtmlDocument'

/**
 * 转义文本为安全的 HTML 文本（避免注入）。
 */
function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

/**
 * 将数值转换为 CSS 长度：
 * - 绝对值 < 1 认为是百分比（例如 0.5 -> 50%）
 * - 否则使用像素 px
 */
function cssPxOrPercent(val: number): string {
  if (Math.abs(val) < 1) return `${(val * 100).toFixed(4)}%`
  return `${val}px`
}

/**
 * 将数值转换为字体尺寸：
 * - 绝对值 < 1 认为是相对单位 em
 * - 否则使用 px
 */
function cssFontSize(val: number): string {
  if (Math.abs(val) < 1) return `${val}em`
  return `${val}px`
}

/**
 * 粗略判断文本方向（RTL/LTR）。
 * 仅基于字符范围做启发式判断。
 */
function detectDir(text: string): TextDir {
  // 粗糙的 RTL 检测规则
  const rtlRegex = /[\u0591-\u07FF\uFB1D-\uFDFD\uFE70-\uFEFC]/
  if (rtlRegex.test(text)) return TextDir.RTL
  return TextDir.LTR
}

type ParsedInlineStyle = {
  fontSize?: number
  fontFamily?: string
  fontWeight?: number
  italic?: boolean
  color?: string
  lineHeight?: number
}

function buildInlineStyleMap(styleText: string | null): Map<string, string> {
  if (!styleText) return new Map()

  return styleText.split(';').reduce((acc, decl) => {
    const separator = decl.indexOf(':')
    if (separator === -1) return acc

    const key = decl.slice(0, separator).trim().toLowerCase()
    const value = decl.slice(separator + 1).trim()

    if (key && value) acc.set(key, value)
    return acc
  }, new Map<string, string>())
}

function parseFontSizeValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  if (raw.endsWith('px')) return Number(raw.replace('px', ''))

  if (raw.endsWith('em')) {
    const val = Number(raw.replace('em', ''))
    return Number.isNaN(val) || val === 0 ? 1 : val
  }

  return undefined
}

function parseLineHeightValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  if (raw.endsWith('px')) return Number(raw.replace('px', ''))

  if (raw.endsWith('em')) {
    const val = Number(raw.replace('em', ''))
    return Number.isNaN(val) || val === 0 ? 1.2 : val
  }

  const numeric = Number(raw)
  return Number.isNaN(numeric) ? undefined : numeric
}

function parseFontWeightValue(raw: string | undefined): number | undefined {
  if (!raw) return undefined
  if (raw === 'bold') return 700
  if (raw === 'normal') return 400

  const numeric = Number(raw)
  return Number.isNaN(numeric) || numeric === 0 ? 400 : numeric
}

function parseItalicValue(raw: string | undefined): boolean | undefined {
  if (!raw) return undefined
  return /italic|oblique/i.test(raw)
}

function setInlineStyleValue<K extends keyof ParsedInlineStyle>(
  target: ParsedInlineStyle,
  key: K,
  value: ParsedInlineStyle[K] | undefined
): void {
  if (value != null) {
    target[key] = value
  }
}

function mergeInlineStyleValue<K extends keyof ParsedInlineStyle>(
  target: ParsedInlineStyle,
  source: ParsedInlineStyle,
  key: K
): void {
  if (target[key] == null) {
    setInlineStyleValue(target, key, source[key])
  }
}

/**
 * 解析元素的行内样式，并抽取与文本排版相关的少量字段。
 * 仅解析 style="..."，不会读取计算样式或样式表。
 */
function parseInlineStyle(el: Element): ParsedInlineStyle {
  const map = buildInlineStyleMap(el.getAttribute('style'))
  const result: ParsedInlineStyle = {}

  const entries: Array<
    [keyof ParsedInlineStyle, ParsedInlineStyle[keyof ParsedInlineStyle]]
  > = [
    ['fontSize', parseFontSizeValue(map.get('font-size'))],
    ['lineHeight', parseLineHeightValue(map.get('line-height'))],
    ['fontWeight', parseFontWeightValue(map.get('font-weight'))],
    ['italic', parseItalicValue(map.get('font-style'))],
    ['color', map.get('color')],
    ['fontFamily', map.get('font-family')]
  ]

  entries.forEach(([key, value]) => setInlineStyleValue(result, key, value))

  return result
}

export class HtmlParser extends DocumentParser {
  static readonly ext = 'html'

  // 复用的内部样式片段
  private static getFragmentStyle(): string {
    return `
      .hamster-note-document { position: relative; display: block; contain: layout style size; }
      .hamster-note-document .hamster-note-page { position: relative; overflow: hidden; background-repeat: no-repeat; background-position: top center; background-size: contain; }
      .hamster-note-document .hamster-note-text { position: absolute; white-space: pre; transform-origin: 0 0; }
    `.replace(/\n\s+/g, ' ')
  }

  // 复用的单个文本渲染
  private static renderTextSpan(t: IntermediateText): string {
    const left = cssPxOrPercent(t.x)
    const top = cssPxOrPercent(t.y)
    const fs = cssFontSize(t.fontSize)
    const lh = cssFontSize(t.lineHeight)
    const width = cssPxOrPercent(t.width)
    const height = cssPxOrPercent(t.height)
    const dir = t.dir === TextDir.RTL ? 'rtl' : 'ltr'
    const writingMode =
      t.vertical || t.dir === TextDir.TTB ? 'vertical-rl' : 'horizontal-tb'
    const color =
      t.color && t.color !== 'transparent' ? `color:${t.color};` : ''
    const family = t.fontFamily ? `font-family:${t.fontFamily};` : ''
    const weight = `font-weight:${t.fontWeight || 400};`
    const fontStyle = t.italic ? 'font-style:italic;' : 'font-style:normal;'
    const transformParts: string[] = []
    if (t.rotate) transformParts.push(`rotate(${t.rotate}deg)`)
    if (t.skew) transformParts.push(`skewX(${t.skew}deg)`)
    const transform = transformParts.length
      ? `transform:${transformParts.join(' ')};`
      : ''
    return `<span class="hamster-note-text" id="${t.id}" style="left:${left};top:${top};width:${width};height:${height};font-size:${fs};line-height:${lh};${weight}${fontStyle}${family}${color}direction:${dir};writing-mode:${writingMode};${transform}">${escapeHtml(t.content)}</span>`
  }

  // 复用的页面渲染
  private static async lazyRenderPageDiv(p: IntermediatePage): Promise<string> {
    console.log('renderPage')
    const texts = p.texts.map((t) => HtmlParser.renderTextSpan(t)).join('')
    const thumb = await p.getThumbnail(0.3)
    const bg = thumb ? `background-image:url('${thumb}');` : ''
    // const bg = thumb ? `background-image:url('${thumb}');` : ''
    return `<div class="hamster-note-page" id="${p.id}" style="width:${cssPxOrPercent(p.width)};height:${cssPxOrPercent(p.height)};${bg}">${texts}</div>`
  }

  /**
   * 将二进制 HTML 内容解码为 UTF-8 字符串。
   */
  private static decodeBufferToString(buffer: ArrayBuffer): string | undefined {
    try {
      return new TextDecoder('utf-8').decode(buffer)
    } catch {
      return undefined
    }
  }

  /**
   * 从某个文本节点向上（父节点链）采集行内样式，仅在当前字段未被填充时才采用祖先的值。
   * 注意：仅解析 style="..."，不读取计算样式，属于启发式近似。
   */
  private static collectAncestorInlineStyle(
    node: Node,
    defaults: { fontSize: number; lineHeight: number }
  ): Required<
    Pick<
      ReturnType<typeof parseInlineStyle>,
      | 'fontSize'
      | 'lineHeight'
      | 'fontWeight'
      | 'italic'
      | 'color'
      | 'fontFamily'
    >
  > {
    const collected: ReturnType<typeof parseInlineStyle> = {}
    let cur: Node | null = node.parentNode
    const inlineFields: Array<keyof ParsedInlineStyle> = [
      'fontSize',
      'lineHeight',
      'fontWeight',
      'italic',
      'color',
      'fontFamily'
    ]

    const mergeInlineStyle = (
      target: ReturnType<typeof parseInlineStyle>,
      source: ReturnType<typeof parseInlineStyle>
    ): void => {
      inlineFields.forEach((field) => {
        mergeInlineStyleValue(target, source, field)
      })
    }

    while (cur && cur.nodeType === Node.ELEMENT_NODE) {
      mergeInlineStyle(collected, parseInlineStyle(cur as Element))
      cur = (cur as Element).parentElement
    }
    const fontSize = collected.fontSize ?? defaults.fontSize
    const lineHeight = collected.lineHeight ?? fontSize * defaults.lineHeight
    return {
      fontSize,
      lineHeight,
      fontWeight: collected.fontWeight ?? 400,
      italic: !!collected.italic,
      color: collected.color || '#000',
      fontFamily: collected.fontFamily || ''
    }
  }

  /**
   * 基于启发式估算文本的尺寸信息。
   * - width ≈ 字符数 * 字号 * 0.6
   * - height = lineHeight（取整并确保最小为 1）
   */
  private static estimateTextMetrics(
    content: string,
    fontSize: number,
    lineHeight: number
  ): { width: number; height: number; ascent: number; descent: number } {
    const width = Math.max(1, Math.round(content.length * fontSize * 0.6))
    const height = Math.max(1, Math.round(lineHeight))
    const ascent = Math.round(fontSize * 0.8)
    const descent = Math.round(fontSize * 0.2)
    return { width, height, ascent, descent }
  }

  /**
   * 使用 DOMParser 解析 HTML，并以 DFS 遍历 body，收集文本节点为 IntermediateText 列表。
   * 若解析失败抛错，由调用方处理回退方案。
   */
  private static collectTextsFromHtml(
    html: string,
    id: string
  ): { title: string; texts: IntermediateText[]; pageHeight: number } {
    const parser = new DOMParser()
    const doc = parser.parseFromString(html, 'text/html')
    const title = doc.title || 'Untitled HTML'
    const body = doc.body
    const skipTags = new Set(['SCRIPT', 'STYLE'])
    const texts: IntermediateText[] = []
    const defaultFontSize = 16
    const defaultLineHeight = 1.2
    let idx = 0
    let y = 0

    const walk = (node: Node) => {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as Element
        if (skipTags.has(el.tagName)) return
        for (const child of Array.from(el.childNodes)) walk(child)
        return
      }
      if (node.nodeType !== Node.TEXT_NODE) return

      const raw = String(node.textContent || '')
      const content = raw.replace(/\s+/g, ' ').trim()
      if (!content) return

      // 自底向上采集行内样式；只有在当前字段未设置时才向上采用祖先的值。
      const sty = HtmlParser.collectAncestorInlineStyle(node, {
        fontSize: defaultFontSize,
        lineHeight: defaultLineHeight
      })

      // 估算尺寸（简化布局，仅做渲染近似）
      const { width, height, ascent, descent } = HtmlParser.estimateTextMetrics(
        content,
        sty.fontSize,
        sty.lineHeight
      )

      const text = new IntermediateText({
        id: `${id}-page-1-text-${idx++}`,
        content,
        fontSize: sty.fontSize,
        fontFamily: sty.fontFamily,
        fontWeight: sty.fontWeight,
        italic: sty.italic,
        color: sty.color,
        width,
        height,
        lineHeight: sty.lineHeight,
        x: 0,
        y,
        ascent,
        descent,
        vertical: false,
        dir: detectDir(content), // 简单的 LTR/RTL 启发式
        rotate: 0,
        skew: 0,
        isEOL: true
      })
      texts.push(text)
      y += height
    }

    // DFS 遍历 body，收集文本节点
    walk(body)
    const pageHeight = Math.max(
      1,
      Math.round(texts.reduce((a, t) => Math.max(a, t.y + t.height), 0))
    )
    return { title, texts, pageHeight }
  }

  /**
   * 当无法解析 DOM 时的兜底：将整段 HTML 当作纯文本，按行切分后构造文本块。
   */
  private static fallbackPlainText(
    html: string,
    id: string
  ): { texts: IntermediateText[]; pageHeight: number } {
    const lines = html.split(/\n+/)
    const texts: IntermediateText[] = []
    let y = 0
    let idx = 0
    const fontSize = 16
    const lineHeight = Math.round(fontSize * 1.2)
    for (const ln of lines) {
      const content = ln.trim()
      if (!content) {
        y += lineHeight
        continue
      }
      const { width, height, ascent, descent } = HtmlParser.estimateTextMetrics(
        content,
        fontSize,
        lineHeight
      )
      texts.push(
        new IntermediateText({
          id: `${id}-page-1-text-${idx++}`,
          content,
          fontSize,
          fontFamily: '',
          fontWeight: 400,
          italic: false,
          color: '#000',
          width,
          height,
          lineHeight,
          x: 0,
          y,
          ascent,
          descent,
          vertical: false,
          dir: TextDir.LTR,
          rotate: 0,
          skew: 0,
          isEOL: true
        })
      )
      y += height
    }
    const pageHeight = Math.max(
      1,
      Math.round(texts.reduce((a, t) => Math.max(a, t.y + t.height), 0))
    )
    return { texts, pageHeight }
  }

  /**
   * encode：从 HTML 文本构建 HtmlDocument。
   *
   * 输入：File | ArrayBuffer（UTF-8 编码的 HTML 文本）
   * 流程：
   * 1) 读取并解码为字符串
   * 2) 在浏览器中用 DOMParser 解析，遍历 body 所有文本节点
   * 3) 向上收集行内样式（font-size/line-height/font-weight/...）
   * 4) 估算每段文本的 width/height 与 y 累进，用于简单布局
   * 5) 若解析失败，退化为按行拆分的纯文本处理
   * 6) 返回 HtmlDocument 实例（包装 IntermediateDocument）
   */
  static async encode(
    fileOrBuffer: File | ArrayBuffer
  ): Promise<HtmlDocument | undefined> {
    const buffer = await this.toArrayBuffer(fileOrBuffer).catch(() => undefined)
    if (!buffer) return undefined

    // 1) 解码为字符串；失败则直接返回 undefined
    const html = this.decodeBufferToString(buffer)
    if (html == null) return undefined

    const id = `html-${Date.now()}`
    const pageWidth = 800
    let title = 'Untitled HTML'
    let texts: IntermediateText[] = []
    let pageHeight = 0

    // 2) 优先走 DOM 解析（浏览器环境下有 DOMParser）
    if (typeof DOMParser !== 'undefined') {
      try {
        const res = HtmlParser.collectTextsFromHtml(html, id)
        title = res.title || title
        texts = res.texts
        pageHeight = res.pageHeight
      } catch (e) {
        // DOM 解析失败则进入兜底逻辑
        console.error(e)
      }
    }

    // 3) 兜底方案：纯文本按行拆分
    if (texts.length === 0) {
      const res = HtmlParser.fallbackPlainText(html, id)
      texts = res.texts
      pageHeight = res.pageHeight
    }

    // 4) 构建单页文档的惰性 page 列表
    const infoList = [
      {
        id: `${id}-page-1`,
        pageNumber: 1,
        size: { x: pageWidth, y: pageHeight },
        getData: async () =>
          new IntermediatePage({
            id: `${id}-page-1`,
            number: 1,
            width: pageWidth,
            height: pageHeight,
            texts,
            thumbnail: undefined
          })
      }
    ]
    const pagesMap = IntermediatePageMap.makeByInfoList(infoList)
    const intermediateDocument = new IntermediateDocument({
      id,
      title,
      pagesMap
    })

    // 5) 返回 HtmlDocument 包装
    return new HtmlDocument(intermediateDocument)
  }

  /**
   * 将 IntermediateDocument 渲染为不带 <html>/<body> 的 HTML 片段，
   * 外层包裹一个 .hamster-note-document 容器，内含若干页面与文本元素。
   */
  static async decodeToHtml(
    intermediateDocument: IntermediateDocument
  ): Promise<string> {
    // 片段 CSS：只包含必要的定位/换行/变换等基础样式
    const pages = await intermediateDocument.pages
    const style = HtmlParser.getFragmentStyle()

    const pageHtml = await Promise.all(
      pages.map((p) => HtmlParser.lazyRenderPageDiv(p))
    )

    return `<div class="hamster-note-document"><style>${style}</style>${pageHtml.join('')}</div>`
  }

  /**
   * 将 IntermediateDocument 包裹为完整的单文件 HTML：
   * - <html> + <head> + <body>，title 使用文档标题
   * - 优先返回 File（浏览器环境可用），失败时退化到 ArrayBuffer
   */
  static async decode(
    intermediateDocument: IntermediateDocument
  ): Promise<File | ArrayBuffer | undefined> {
    const inner = await this.decodeToHtml(intermediateDocument)
    const title = intermediateDocument.title || 'document'
    const fullHtml = `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1"/><title>${escapeHtml(
      title
    )}</title></head><body>${inner}</body></html>`

    try {
      return new File([fullHtml], `${title}.html`, { type: 'text/html' })
    } catch {
      // 某些运行环境（或较旧浏览器）可能不支持 File 构造器
      const enc = new TextEncoder()
      return enc.encode(fullHtml).buffer
    }
  }
}
