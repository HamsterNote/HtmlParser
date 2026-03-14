type SerializedText = {
  id: string
  content: string
  fontSize: number
  fontFamily: string
  fontWeight: number
  italic: boolean
  color: string
  width: number
  height: number
  lineHeight: number
  x: number
  y: number
  ascent: number
  descent: number
  vertical: boolean
  dir: string
  rotate: number
  skew: number
  isEOL: boolean
}

type SerializedOutline = SerializedText & {
  dest?: unknown
}

type SerializedPage = {
  id: string
  number: number
  width: number
  height: number
  thumbnail?: string
  texts: SerializedText[]
}

type SerializedDocument = {
  id: string
  title: string
  outline?: SerializedOutline[]
  pages: SerializedPage[]
}

type ParsedPage = SerializedPage & {
  getThumbnail: () => Promise<string | undefined>
}

type ParsedDocument = {
  id: string
  title: string
  outline?: SerializedOutline[]
  pages: Promise<ParsedPage[]>
}

export function parseSerializedDocument(data: unknown): ParsedDocument
export function serializeIntermediate(intermediate: {
  id: string
  title: string
  outline?: SerializedOutline[]
  getOutline?: () => SerializedOutline[] | undefined
  pages: Promise<
    Array<{
      id: string
      number: number
      width: number
      height: number
      getTexts: () => Promise<SerializedText[]>
      getThumbnail: (scale?: number) => Promise<string | undefined>
    }>
  >
}): Promise<SerializedDocument>
