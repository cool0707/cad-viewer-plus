import {
  AcDbDatabaseConverterManager,
  AcDbFileType
} from '@mlightcad/data-model'

/**
 * Drawing formats that are always offered. DXF is built in; DWG is listed even
 * before a DWG converter is registered so that opening one reports a clear
 * "converter not registered" error instead of being filtered out.
 */
const BUILTIN_DRAWING_FILE_TYPES: readonly string[] = [
  AcDbFileType.DWG,
  AcDbFileType.DXF
]

/**
 * Lower-case file types (extensions without the dot) the viewer can open:
 * DWG, DXF and every type registered with `AcDbDatabaseConverterManager`
 * (for example `jww`).
 */
export function acapDrawingFileTypes(): string[] {
  const types = new Set(BUILTIN_DRAWING_FILE_TYPES)
  for (const type of AcDbDatabaseConverterManager.instance.fileTypes) {
    types.add(String(type).toLowerCase())
  }
  return [...types]
}

/** {@link acapDrawingFileTypes} as dotted extensions (`.dwg`, `.dxf`, …). */
export function acapDrawingFileExtensions(): string[] {
  return acapDrawingFileTypes().map(type => `.${type}`)
}

/** Value for `<input type="file" accept>` listing the drawing extensions. */
export function acapDrawingFileAccept(): string {
  return acapDrawingFileExtensions().join(',')
}

/**
 * Returns the converter type for a file name (its lower-case extension) when
 * the viewer can open it, otherwise `undefined`.
 */
export function acapDrawingFileType(fileName: string): string | undefined {
  const dot = fileName.lastIndexOf('.')
  if (dot < 0) return undefined
  const ext = fileName.slice(dot + 1).toLowerCase()
  return acapDrawingFileTypes().includes(ext) ? ext : undefined
}

/** Whether {@link acapDrawingFileType} recognizes the file name. */
export function acapIsDrawingFileName(fileName: string): boolean {
  return acapDrawingFileType(fileName) !== undefined
}

/** Removes a drawing extension (`plan.jww` → `plan`). */
export function acapStripDrawingExtension(fileName: string): string {
  return acapIsDrawingFileName(fileName)
    ? fileName.slice(0, fileName.lastIndexOf('.'))
    : fileName
}
