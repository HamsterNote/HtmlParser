type PreviewDocumentLike = {
  createElement(tagName: string): {
    className: string
    title?: string
    textContent: string | null
    srcdoc?: string
    setAttribute(name: string, value: string): void
  }
}

type PreviewContainer = {
  classList: {
    toggle(token: string, force?: boolean): boolean
  }
  ownerDocument: PreviewDocumentLike
  replaceChildren(...nodes: unknown[]): void
  appendChild(node: unknown): unknown
}

export function setPreviewMessage(
  preview: PreviewContainer | null,
  text: string,
  isError?: boolean
): void

export function renderPreviewHtml(
  preview: PreviewContainer | null,
  html: string
): void
