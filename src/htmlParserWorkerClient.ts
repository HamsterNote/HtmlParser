import {
  buildEncodeDocumentPayload,
  type DecodeHtmlInput,
  type EncodeDocumentBuildInput,
  type EncodeDocumentBuildResult,
  renderDecodeHtmlFromPayload
} from './htmlParserWorkerCore.js'
import type {
  HtmlParserWorkerRequest,
  HtmlParserWorkerResponse
} from './htmlParserWorkerProtocol.js'

let nextWorkerRequestId = 1

type HtmlParserWorkerRequestInput =
  | {
      type: 'encode-build'
      payload: EncodeDocumentBuildInput
    }
  | {
      type: 'decode-html'
      payload: DecodeHtmlInput
    }

function createHtmlParserWorker(): Worker | undefined {
  if (typeof Worker === 'undefined') return undefined

  try {
    return new Worker(new URL('./htmlParser.worker.js', import.meta.url), {
      type: 'module'
    })
  } catch {
    return undefined
  }
}

function postWorkerRequest<T>(
  request: HtmlParserWorkerRequestInput
): Promise<T> | undefined {
  const worker = createHtmlParserWorker()
  if (!worker) return undefined

  const id = nextWorkerRequestId++

  return new Promise<T>((resolve, reject) => {
    worker.onmessage = (event: MessageEvent<HtmlParserWorkerResponse>) => {
      const response = event.data
      if (response.id !== id) return

      worker.terminate()
      if (response.ok) {
        resolve(response.payload as T)
      } else {
        reject(new Error(response.error))
      }
    }

    worker.onerror = (event) => {
      worker.terminate()
      reject(new Error(event.message || 'HtmlParser worker failed'))
    }

    const workerRequest: HtmlParserWorkerRequest =
      request.type === 'encode-build'
        ? { id, type: request.type, payload: request.payload }
        : { id, type: request.type, payload: request.payload }

    worker.postMessage(workerRequest)
  })
}

export async function runEncodeDocumentBuildInWorker(
  input: EncodeDocumentBuildInput
): Promise<EncodeDocumentBuildResult> {
  const workerResult = postWorkerRequest<EncodeDocumentBuildResult>({
    type: 'encode-build',
    payload: input
  })

  if (!workerResult) return buildEncodeDocumentPayload(input)

  try {
    return await workerResult
  } catch {
    return buildEncodeDocumentPayload(input)
  }
}

export async function runDecodeHtmlInWorker(
  input: DecodeHtmlInput
): Promise<string> {
  const workerResult = postWorkerRequest<string>({
    type: 'decode-html',
    payload: input
  })

  if (!workerResult) return renderDecodeHtmlFromPayload(input)

  try {
    return await workerResult
  } catch {
    return renderDecodeHtmlFromPayload(input)
  }
}
