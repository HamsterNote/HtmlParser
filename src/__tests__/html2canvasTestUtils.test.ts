import { installFakeHtml2Canvas } from '../testUtils/html2canvasTestUtils.js'
import { setHtml2CanvasLoader } from '../index.js'
import { withDomDocument } from '../testUtils/domTestUtils.js'

describe('html2canvasTestUtils', () => {
  afterEach(() => {
    setHtml2CanvasLoader(null)
  })

  it('does not call the loader before any consumer awaits it', async () => {
    const handle = installFakeHtml2Canvas()
    expect(handle.loaderCallCount).toBe(0)
    handle.restore()
  })

  it('records calls with element and options on success', async () => {
    await withDomDocument(async (window) => {
      const fakeEl = window.document.createElement('div')
      const handle = installFakeHtml2Canvas({ behavior: 'resolve', dataUrl: 'data:image/png;base64,ABCD' })

      const fake = handle.fake
      await fake(fakeEl, { backgroundColor: 'red' })

      expect(handle.calls).toHaveLength(1)
      expect(handle.calls[0].element).toBe(fakeEl)
      expect(handle.calls[0].options).toEqual({ backgroundColor: 'red' })
      handle.restore()
    })
  })

  it('rejects when configured to reject', async () => {
    await withDomDocument(async (window) => {
      const testError = new Error('capture failed')
      const handle = installFakeHtml2Canvas({ behavior: 'reject', error: testError })

      const fake = handle.fake
      await expect(fake(window.document.createElement('div'))).rejects.toThrow('capture failed')
      handle.restore()
    })
  })
})