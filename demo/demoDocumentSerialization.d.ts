type SerializedOutlineItem = Record<string, unknown>

type SerializedText = Record<string, unknown>
type SerializedImage = Record<string, unknown>
type SerializedContent = SerializedText | SerializedImage

type SerializedPage = {
  id: string
  number: number
  width: number
  height: number
  texts?: SerializedText[]
  images?: SerializedImage[]
  content?: SerializedContent[]
  thumbnail?: string
}

type ParsedSerializedPage = SerializedPage & {
  getTexts(): Promise<SerializedText[]>
  getContent(): Promise<SerializedContent[]>
  getThumbnail(scale?: number): Promise<string | undefined>
}

export type SerializedIntermediateDocument = {
  id: string
  title: string
  outline: SerializedOutlineItem[]
  textControl?: unknown
  background?: Record<string, unknown>
  pages: SerializedPage[]
}

export declare function serializeIntermediate(intermediate: {
  id: string
  title: string
  pages: Promise<
    Array<{
      id: string
      number: number
      width: number
      height: number
      content?: SerializedContent[]
      texts?: SerializedText[]
      images?: SerializedImage[]
      thumbnail?: string
      getContent?(): Promise<SerializedContent[]>
      getTexts?(): Promise<SerializedText[]>
      getThumbnail?(scale: number): Promise<string | undefined>
    }>
  >
  getOutline?(): SerializedOutlineItem[] | undefined
  outline?: SerializedOutlineItem[]
}): Promise<SerializedIntermediateDocument>

export type ParsedSerializedIntermediateDocument = {
  id: string
  title: string
  outline: SerializedOutlineItem[]
  pages: Promise<ParsedSerializedPage[]>
  getOutline(): SerializedOutlineItem[]
}

export type BackgroundDecodeOptions = {
  includeBackground?: boolean
  backgroundQuality?: number
  excludeTextFromBackground?: boolean
}

export type ParsedSerializedDocumentDecoder = (
  document: ParsedSerializedIntermediateDocument,
  options?: { textControl?: Record<string, unknown>; background?: BackgroundDecodeOptions }
) => Promise<string>

export declare function parseSerializedDocument(
  serialized: SerializedIntermediateDocument
): ParsedSerializedIntermediateDocument

export declare function decodeSerializedDocumentToHtml(
  serialized: SerializedIntermediateDocument,
  decodeToHtml?: ParsedSerializedDocumentDecoder
): Promise<string>
