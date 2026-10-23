import {
  AcDbDatabase,
  AcDbDatabaseConverter,
  type AcDbDatabaseConverterConfig,
  AcDbDatabaseConverterManager,
  type AcDbDatabaseConverterReadOptions,
  AcDbFileType,
  AcDbNativeDxfConverter,
  log
} from '@mlightcad/data-model'

import {
  convertJwwToDxf,
  type JwwConversionResult,
  type JwwScaleMode
} from './jwwToDxf'
import type { JwwWorkerRequest, JwwWorkerResponse } from './jwwWorkerProtocol'

/** Configuration of {@link AcDbJwwConverter}. */
export interface AcDbJwwConverterConfig extends AcDbDatabaseConverterConfig {
  /**
   * URL of the ezjww wasm (`jww-parser.wasm`).
   *
   * With a worker it defaults to the file next to the worker script. Without
   * a worker it is required unless ezjww has already been initialized.
   */
  wasmUrl?: string | URL
  /**
   * How paper millimetres become drawing units.
   *
   * @default 'drawing'
   */
  scaleMode?: JwwScaleMode
}

/**
 * Reads Jw_cad drawings (`.jww`, and the older `.jwc`).
 *
 * The file is parsed by ezjww (MIT, Rust → WebAssembly), converted to DXF in
 * real-world millimetres, and then loaded by the registered DXF converter, so
 * layers, blocks and text styles follow the regular DXF path.
 *
 * @example
 * ```ts
 * AcDbDatabaseConverterManager.instance.register(
 *   'jww',
 *   new AcDbJwwConverter({ parserWorkerUrl: './assets/jww-parser-worker.js' })
 * )
 * ```
 */
export class AcDbJwwConverter extends AcDbDatabaseConverter {
  private worker?: Worker
  private nextRequestId = 1
  private readonly pending = new Map<
    number,
    {
      resolve: (result: JwwConversionResult) => void
      reject: (error: Error) => void
    }
  >()

  constructor(config: AcDbJwwConverterConfig = {}) {
    super({ useWorker: true, ...config })
  }

  override async read(
    data: ArrayBuffer,
    db: AcDbDatabase,
    options?: AcDbDatabaseConverterReadOptions
  ): Promise<void> {
    const timeout = this.getParserWorkerTimeout(data, options?.timeout)
    const result = await this.toDxf(data, timeout)
    if (result.unsupportedEntities.length > 0) {
      log.warn(
        `[JWW] ${result.unsupportedEntities.length} entities were not converted:`,
        [...new Set(result.unsupportedEntities)].join(', ')
      )
    }
    const bytes = new TextEncoder().encode(result.dxf)
    const dxfConverter =
      AcDbDatabaseConverterManager.instance.get(AcDbFileType.DXF) ??
      new AcDbNativeDxfConverter()
    await dxfConverter.read(bytes.buffer as ArrayBuffer, db, {
      ...options,
      encoding: 'utf-8'
    })
  }

  /** Converts JWW bytes to DXF text (in the worker when configured). */
  async toDxf(
    data: ArrayBuffer,
    timeout = 30000
  ): Promise<JwwConversionResult> {
    const config = this.config as AcDbJwwConverterConfig
    if (config.useWorker !== false && config.parserWorkerUrl) {
      return this.toDxfInWorker(data, timeout)
    }
    const ezjww = await import('ezjww')
    if (!ezjww.isInitialized()) {
      if (!config.wasmUrl) {
        throw new Error(
          'AcDbJwwConverter: set parserWorkerUrl or wasmUrl to load the JWW parser'
        )
      }
      const response = await fetch(config.wasmUrl)
      if (!response.ok) {
        throw new Error(
          `Failed to load ${String(config.wasmUrl)} (HTTP ${response.status})`
        )
      }
      await ezjww.initAsync(await response.arrayBuffer())
    }
    return convertJwwToDxf(ezjww, new Uint8Array(data), {
      scaleMode: config.scaleMode
    })
  }

  /** Stops the parser worker. A later read starts a new one. */
  dispose() {
    this.worker?.terminate()
    this.worker = undefined
    for (const { reject } of this.pending.values()) {
      reject(new Error('JWW parser worker was terminated'))
    }
    this.pending.clear()
  }

  private toDxfInWorker(data: ArrayBuffer, timeout: number) {
    const config = this.config as AcDbJwwConverterConfig
    const worker = this.ensureWorker()
    const id = this.nextRequestId++
    return new Promise<JwwConversionResult>((resolve, reject) => {
      const timer = setTimeout(() => {
        // The wasm call cannot be interrupted; drop the worker instead.
        this.dispose()
        reject(new Error(`JWW parsing timed out after ${timeout} ms`))
      }, timeout)
      this.pending.set(id, {
        resolve: result => {
          clearTimeout(timer)
          resolve(result)
        },
        reject: error => {
          clearTimeout(timer)
          reject(error)
        }
      })
      // Copy so the caller's buffer is not detached by the transfer.
      const copy = data.slice(0)
      const request: JwwWorkerRequest = {
        id,
        data: copy,
        scaleMode: config.scaleMode,
        wasmUrl: config.wasmUrl
          ? new URL(String(config.wasmUrl), globalThis.location?.href).href
          : undefined
      }
      worker.postMessage(request, [copy])
    })
  }

  private ensureWorker() {
    if (!this.worker) {
      const worker = new Worker(this.config.parserWorkerUrl!)
      worker.onmessage = (event: MessageEvent<JwwWorkerResponse>) => {
        const response = event.data
        const request = this.pending.get(response.id)
        if (!request) return
        this.pending.delete(response.id)
        if (response.ok) {
          request.resolve({
            dxf: response.dxf,
            unsupportedEntities: response.unsupportedEntities
          })
        } else {
          request.reject(new Error(response.error))
        }
      }
      worker.onerror = event => {
        const error = new Error(
          `JWW parser worker failed: ${event.message || 'unknown error'}`
        )
        for (const { reject } of this.pending.values()) reject(error)
        this.pending.clear()
        this.worker?.terminate()
        this.worker = undefined
      }
      this.worker = worker
    }
    return this.worker
  }
}
