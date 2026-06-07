import {
  buildEncodeDocumentPayload,
  renderDecodeHtmlFromPayload
} from './htmlParserWorkerCore.js'
import type {
  HtmlParserWorkerRequest,
  HtmlParserWorkerResponse
} from './htmlParserWorkerProtocol.js'

type HtmlParserWorkerScope = typeof globalThis & {
  onmessage: ((event: MessageEvent<HtmlParserWorkerRequest>) => void) | null
  postMessage(message: HtmlParserWorkerResponse): void
}

const workerScope = globalThis as HtmlParserWorkerScope

workerScope.onmessage = (event) => {
  const request = event.data

  try {
    if (request.type === 'encode-build') {
      workerScope.postMessage({
        id: request.id,
        ok: true,
        payload: buildEncodeDocumentPayload(request.payload)
      })
      return
    }

    workerScope.postMessage({
      id: request.id,
      ok: true,
      payload: renderDecodeHtmlFromPayload(request.payload)
    })
  } catch (error) {
    workerScope.postMessage({
      id: request.id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    })
  }
}
