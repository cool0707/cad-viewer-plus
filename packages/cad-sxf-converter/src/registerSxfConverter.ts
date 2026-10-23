import { AcDbDatabaseConverterManager } from '@mlightcad/data-model'

import {
  AcDbSxfConverter,
  type AcDbSxfConverterConfig
} from './AcDbSxfConverter'

/** File types (extensions) read by {@link AcDbSxfConverter}. */
export const SXF_FILE_TYPES = ['sfc'] as const

/** Registers {@link AcDbSxfConverter} for SXF files. */
export function registerSxfConverter(config: AcDbSxfConverterConfig = {}) {
  const converter = new AcDbSxfConverter(config)
  for (const type of SXF_FILE_TYPES) {
    AcDbDatabaseConverterManager.instance.register(type, converter)
  }
  return converter
}
