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

import { convertSxfToDxf } from './convertSxf'
import type { SxfScaleMode } from './sxfToDxf'

/** Configuration of {@link AcDbSxfConverter}. */
export interface AcDbSxfConverterConfig extends AcDbDatabaseConverterConfig {
  /**
   * How paper millimetres become drawing units.
   *
   * @default 'drawing'
   */
  scaleMode?: SxfScaleMode
}

/**
 * Reads SXF drawings (the Japanese CAD data exchange standard used for
 * public works deliverables): SFC feature files.
 *
 * The file is parsed in TypeScript (no WebAssembly), flattened into lines,
 * curves, text and fills, written as DXF and loaded by the registered DXF
 * converter.
 */
export class AcDbSxfConverter extends AcDbDatabaseConverter {
  constructor(config: AcDbSxfConverterConfig = {}) {
    super({ useWorker: false, ...config })
  }

  override async read(
    data: ArrayBuffer,
    db: AcDbDatabase,
    options?: AcDbDatabaseConverterReadOptions
  ): Promise<void> {
    const config = this.config as AcDbSxfConverterConfig
    const result = convertSxfToDxf(new Uint8Array(data), {
      scaleMode: config.scaleMode
    })
    if (result.warnings.length > 0) {
      log.warn(
        `[SXF] ${result.warnings.length} conversion notes:`,
        result.warnings
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
}
