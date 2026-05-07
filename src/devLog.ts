export function devConsoleLog(label: string, data?: unknown): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return
  }

  // eslint-disable-next-line no-console
  console.log(`[HtmlParser] ${label}`, data !== undefined ? data : '')
}

export function devConsoleWarn(label: string, data?: unknown): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return
  }

  // eslint-disable-next-line no-console
  console.warn(`[HtmlParser] ⚠️ ${label}`, data !== undefined ? data : '')
}

export function devConsoleError(label: string, data?: unknown): void {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return
  }

  // eslint-disable-next-line no-console
  console.error(`[HtmlParser] ❌ ${label}`, data !== undefined ? data : '')
}
