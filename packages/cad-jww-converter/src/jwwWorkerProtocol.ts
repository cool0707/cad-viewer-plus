import type { JwwConversionResult, JwwScaleMode } from './jwwToDxf'

/** Message posted to the JWW parser worker. */
export interface JwwWorkerRequest {
  id: number
  data: ArrayBuffer
  /** Overrides the wasm location (resolved against the worker URL). */
  wasmUrl?: string
  scaleMode?: JwwScaleMode
}

/** Message the JWW parser worker posts back. */
export type JwwWorkerResponse =
  | ({ id: number; ok: true } & JwwConversionResult)
  | { id: number; ok: false; error: string }
