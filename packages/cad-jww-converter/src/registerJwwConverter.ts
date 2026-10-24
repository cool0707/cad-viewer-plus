import { AcDbDatabaseConverterManager } from '@mlightcad/data-model'

import {
  AcDbJwwConverter,
  type AcDbJwwConverterConfig
} from './AcDbJwwConverter'
import { JWC_FILE_TYPE, JWW_FILE_TYPE } from './constants'

/**
 * Registers {@link AcDbJwwConverter} for Jw_cad files (`.jww` and the older
 * `.jwc`).
 *
 * @param parserWorkerUrl - URL of `jww-parser-worker.js` (with
 *   `jww-parser.wasm` next to it)
 * @returns The registered converter
 */
export function registerJwwConverter(
  parserWorkerUrl: string | URL,
  config: Omit<AcDbJwwConverterConfig, 'parserWorkerUrl'> = {}
): AcDbJwwConverter {
  const converter = new AcDbJwwConverter({ ...config, parserWorkerUrl })
  AcDbDatabaseConverterManager.instance.register(JWW_FILE_TYPE, converter)
  AcDbDatabaseConverterManager.instance.register(JWC_FILE_TYPE, converter)
  return converter
}
