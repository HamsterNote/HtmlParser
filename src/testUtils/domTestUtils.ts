import { Window } from 'happy-dom'
import { setIframeHostDocument } from '../index.js'

type GlobalSnapshot = Map<string, PropertyDescriptor | undefined>

const restoreGlobals = (snapshot: GlobalSnapshot): void => {
  for (const [key, descriptor] of snapshot.entries()) {
    if (descriptor) {
      Object.defineProperty(globalThis, key, descriptor)
    } else {
      delete (globalThis as Record<string, unknown>)[key]
    }
  }
}

export const withDomDocument = async <T>(
  fn: (window: any) => Promise<T>
): Promise<T> => {
  const window = new Window()
  setIframeHostDocument(window.document as unknown as Parameters<typeof setIframeHostDocument>[0])

  try {
    return await fn(window)
  } finally {
    setIframeHostDocument(null)
  }
}

export const withGlobalsRemoved = async <T>(
  keys: string[],
  fn: () => Promise<T>
): Promise<T> => {
  const snapshot: GlobalSnapshot = new Map()

  for (const key of keys) {
    snapshot.set(key, Object.getOwnPropertyDescriptor(globalThis, key))
    delete (globalThis as Record<string, unknown>)[key]
  }

  try {
    return await fn()
  } finally {
    restoreGlobals(snapshot)
  }
}
