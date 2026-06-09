import type {
  DecodeHtmlInput,
  EncodeDocumentBuildInput,
  EncodeDocumentBuildResult
} from './htmlParserWorkerCore.js'

export type HtmlParserWorkerRequest =
  | {
      id: number
      type: 'encode-build'
      payload: EncodeDocumentBuildInput
    }
  | {
      id: number
      type: 'decode-html'
      payload: DecodeHtmlInput
    }

export type HtmlParserWorkerResponse =
  | {
      id: number
      ok: true
      payload: EncodeDocumentBuildResult | string
    }
  | {
      id: number
      ok: false
      error: string
    }
