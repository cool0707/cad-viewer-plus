/// <reference lib="webworker" />
/**
 * Web Worker that parses JWW files with ezjww (WebAssembly) and returns DXF
 * text. Built as a standalone bundle (`jww-parser-worker.js`).
 */
import * as ezjww from 'ezjww'

import { JWW_PARSER_WASM_FILE } from './constants'
import { convertJwwToDxf } from './jwwToDxf'
import type { JwwWorkerRequest, JwwWorkerResponse } from './jwwWorkerProtocol'

let ready: Promise<void> | undefined

function init(wasmUrl?: string) {
  if (!ready) {
    const url = new URL(wasmUrl ?? JWW_PARSER_WASM_FILE, self.location.href)
    ready = fetch(url)
      .then(response => {
        if (!response.ok) {
          throw new Error(
            `Failed to load ${url.href} (HTTP ${response.status})`
          )
        }
        return response.arrayBuffer()
      })
      .then(bytes => ezjww.initAsync(bytes))
    ready.catch(() => {
      ready = undefined
    })
  }
  return ready
}

self.onmessage = async (event: MessageEvent<JwwWorkerRequest>) => {
  const { id, data, wasmUrl, scaleMode } = event.data
  let response: JwwWorkerResponse
  try {
    await init(wasmUrl)
    const result = convertJwwToDxf(ezjww, new Uint8Array(data), { scaleMode })
    response = { id, ok: true, ...result }
  } catch (error) {
    response = {
      id,
      ok: false,
      error: error instanceof Error ? error.message : String(error)
    }
  }
  self.postMessage(response)
}
