import { setHtml2CanvasLoader } from '../index.js'
import type { Html2CanvasLike } from '../index.js'

export interface FakeHtml2CanvasOptions {
  behavior?: 'resolve' | 'reject'
  dataUrl?: string
  error?: Error
  loaderDelayMs?: number
}

export interface FakeHtml2CanvasCall {
  element: HTMLElement
  options: Record<string, unknown> | undefined
}

export interface FakeHtml2CanvasHandle {
  fake: Html2CanvasLike
  calls: FakeHtml2CanvasCall[]
  loaderCallCount: number
  restore: () => void
}

export function installFakeHtml2Canvas(
  options: FakeHtml2CanvasOptions = {}
): FakeHtml2CanvasHandle {
  const {
    behavior = 'resolve',
    dataUrl = 'data:image/png;base64,FAKE',
    error = new Error('html2canvas mock rejection'),
    loaderDelayMs = 0,
  } = options

  const calls: FakeHtml2CanvasCall[] = []
  let loaderCallCount = 0

  const fake: Html2CanvasLike = (element, opts) => {
    calls.push({ element, options: opts })
    if (behavior === 'reject') {
      return Promise.reject(error)
    }
    return Promise.resolve({
      toDataURL: (_type?: string) => dataUrl,
    })
  }

  const loader = (): Promise<Html2CanvasLike> => {
    loaderCallCount++
    return new Promise<Html2CanvasLike>((resolve) => {
      setTimeout(() => {
        resolve(fake)
      }, loaderDelayMs)
    })
  }

  setHtml2CanvasLoader(loader)

  return {
    fake,
    calls,
    get loaderCallCount() {
      return loaderCallCount
    },
    restore() {
      setHtml2CanvasLoader(null)
    },
  }
}