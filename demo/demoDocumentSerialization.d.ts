type SerializedOutlineItem = Record<string, unknown>

type SerializedText = Record<string, unknown>

type SerializedPage = {
  id: string
  number: number
  width: number
  height: number
  texts: SerializedText[]
  thumbnail?: string
}

type ParsedSerializedPage = SerializedPage & {
  getTexts(): Promise<SerializedText[]>
  getThumbnail(scale?: number): Promise<string | undefined>
}

export type SerializedIntermediateDocument = {
  id: string
  title: string
  outline: SerializedOutlineItem[]
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
      texts?: SerializedText[]
      thumbnail?: string
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

export declare function parseSerializedDocument(
  serialized: SerializedIntermediateDocument
): ParsedSerializedIntermediateDocument

export declare function decodeSerializedDocumentToHtml(
  serialized: SerializedIntermediateDocument
): Promise<string>
