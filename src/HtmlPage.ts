import { HamsterPage, RenderOptions, RenderViews } from '@DocumentParser'
import { IntermediatePage } from '@typesCommon/HamsterDocument/IntermediatePage'
import { TextDir } from '@typesCommon/HamsterDocument/IntermediateText'
import { Number2 } from '@math'

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
 * 将CSSStyleDeclaration转换成 string
 */
function cssStyleDeclarationToString(style: CSSStyleDeclaration): string {
  return Object.entries(style)
    .map(([key, value]) => `${key}:${value}`)
    .join(';')
}

/**
 * HtmlPage 类 - HamsterPage 的 HTML 实现
 * 包装 IntermediatePage，提供懒加载渲染能力
 */
export class HtmlPage extends HamsterPage {
  constructor(private readonly intermediatePage: IntermediatePage) {
    super()
  }

  /**
   * 获取页码
   */
  getNumber(): number {
    return this.intermediatePage.number
  }

  /**
   * 获取缩放后的页面尺寸
   */
  getSize(scale: number): Number2 {
    return {
      x: this.intermediatePage.width * scale,
      y: this.intermediatePage.height * scale
    }
  }

  /**
   * 获取纯文本内容
   */
  getPureText(): string {
    return this.intermediatePage.texts.map((t) => t.content).join('\n')
  }

  /**
   * 渲染页面到容器元素
   * 根据 options 决定渲染缩略图和/或文本内容
   */
  async render(
    container: HTMLDivElement,
    options?: RenderOptions
  ): Promise<void> {
    const scale = options?.scale ?? 1
    const views = options?.views ?? [RenderViews.TEXT, RenderViews.THUMBNAIL]

    // 清空容器
    container.innerHTML = ''

    // 设置容器样式
    container.style.position = 'relative'
    container.style.overflow = 'hidden'
    container.style.width = `${this.intermediatePage.width * scale}px`
    container.style.height = `${this.intermediatePage.height * scale}px`

    // 渲染缩略图背景
    if (views.includes(RenderViews.THUMBNAIL)) {
      const thumbnail = await this.intermediatePage.getThumbnail(0.3)
      if (thumbnail) {
        container.style.backgroundImage = `url('${thumbnail}')`
        container.style.backgroundRepeat = 'no-repeat'
        container.style.backgroundPosition = 'top center'
        container.style.backgroundSize = 'contain'
      }
    }

    // 渲染文本层
    if (views.includes(RenderViews.TEXT)) {
      // 获取文本（可能触发懒加载）
      const texts = await this.intermediatePage.getTexts()

      // 创建文本容器
      const textContainer = document.createElement('div')
      textContainer.style.position = 'absolute'
      textContainer.style.top = '0'
      textContainer.style.left = '0'
      textContainer.style.width = '100%'
      textContainer.style.height = '100%'

      // 渲染所有文本元素
      texts.forEach((text) => {
        const span = document.createElement('span')
        span.className = 'hamster-note-text'
        span.id = text.id
        span.textContent = text.content

        // 应用样式
        const styles = {
          position: 'absolute',
          left: cssPxOrPercent(text.x * scale),
          top: cssPxOrPercent(text.y * scale),
          width: cssPxOrPercent(text.width * scale),
          height: cssPxOrPercent(text.height * scale),
          fontSize: cssFontSize(text.fontSize * scale),
          lineHeight: cssFontSize(text.lineHeight * scale),
          fontWeight: String(text.fontWeight || 400),
          fontStyle: text.italic ? 'italic' : 'normal',
          fontFamily: text.fontFamily || '',
          color: text.color && text.color !== 'transparent' ? text.color : '',
          direction: text.dir === TextDir.RTL ? 'rtl' : 'ltr',
          writingMode:
            text.vertical || text.dir === TextDir.TTB
              ? 'vertical-rl'
              : 'horizontal-tb',
          whiteSpace: 'pre',
          transformOrigin: '0 0'
        }

        const originStyle = new CSSStyleDeclaration()
        Object.entries(styles).forEach(([key, value]) => {
          originStyle.setProperty(key, value)
        })
        span.style = cssStyleDeclarationToString(originStyle)

        // 应用变换
        const transforms: string[] = []
        if (text.rotate) transforms.push(`rotate(${text.rotate}deg)`)
        if (text.skew) transforms.push(`skewX(${text.skew}deg)`)
        if (transforms.length) {
          span.style.transform = transforms.join(' ')
        }

        textContainer.appendChild(span)
      })

      container.appendChild(textContainer)
    }
  }
}
