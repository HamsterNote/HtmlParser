type PreviewContainer = {
  classList: {
    toggle(token: string, force?: boolean): boolean
    remove(...tokens: string[]): void
  }
  replaceChildren(...nodes: unknown[]): void
  append(...nodes: unknown[]): void
}

export declare function setPreviewMessage(
  preview: PreviewContainer | null,
  message: string,
  isError?: boolean
): void

export declare function renderPreviewHtml(
  preview: PreviewContainer | null,
  html: string
): void
