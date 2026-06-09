import { Window } from 'happy-dom'
import { renderPreviewHtml, setPreviewMessage } from '../../demo/demoPreview.js'

describe('demo preview helpers', () => {
  it('renders decoded html into a sandboxed iframe instead of parent DOM', () => {
    const window = new Window()
    const preview = window.document.createElement('div')
    preview.className = 'preview preview-error'

    renderPreviewHtml(
      preview,
      '<div class="hamster-note-document"><script>window.__xss = true</script><p>Hello preview</p></div>'
    )

    const frame = preview.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(preview.classList.contains('preview-error')).toBe(false)
    expect(frame?.getAttribute('sandbox')).toBe('')
    expect(frame?.getAttribute('referrerpolicy')).toBe('no-referrer')
    expect(frame?.getAttribute('src')).toBe('about:blank')
    expect(frame?.getAttribute('srcdoc')).toContain('Hello preview')
    expect(frame?.getAttribute('srcdoc')).toContain(
      '<base href="about:srcdoc" />'
    )
    expect(preview.querySelector('.hamster-note-document')).toBeNull()
    expect(preview.querySelector('script')).toBeNull()
  })

  it('sizes the iframe to decoded page width so the preview container can scroll horizontally', () => {
    const window = new Window()
    const preview = window.document.createElement('div')

    renderPreviewHtml(
      preview,
      '<div class="hamster-note-document"><div class="hamster-note-page" style="width:1440px;height:900px"></div></div>'
    )

    const frame = preview.querySelector('iframe')
    expect(frame).not.toBeNull()
    expect(frame?.style.width).toBe('1440px')
    expect(frame?.style.maxWidth).toBe('none')
    expect(frame?.style.minHeight).toBe('900px')
  })

  it('renders placeholder text in the parent container for messages', () => {
    const window = new Window()
    const preview = window.document.createElement('div')

    setPreviewMessage(preview, 'Decode failed', true)

    expect(preview.classList.contains('preview-error')).toBe(true)
    expect(preview.querySelector('iframe')).toBeNull()
    expect(preview.textContent).toContain('Decode failed')
  })
})
