import { unzipSync } from 'fflate'

import { readP21Drawing } from './p21'
import { readSfcDrawing } from './sfc'
import { decodeSxfBytes } from './step'
import { sxfDrawingToDxf, type SxfDxfOptions } from './sxfToDxf'

/** Result of {@link convertSxfToDxf}. */
export interface SxfConversionResult {
  /** ASCII DXF (AC1024, UTF-8), in millimetres. */
  dxf: string
  /** Detected source format. */
  format: 'sfc' | 'p21'
  /** Features or constructs that could not be represented exactly. */
  warnings: string[]
}

/** Detects SFC (feature comments) vs. P21 (AP202 entities) from the text. */
export function detectSxfFormat(text: string): 'sfc' | 'p21' | undefined {
  const head = text.slice(0, 4096)
  if (!/ISO-10303-21/i.test(head)) return undefined
  if (/feature_mode/i.test(head) || /\/\*SXF/.test(text.slice(0, 200_000))) {
    return 'sfc'
  }
  return 'p21'
}

/** Whether the bytes are a ZIP archive (SFZ / P2Z). */
export function isZip(data: Uint8Array) {
  return data[0] === 0x50 && data[1] === 0x4b && data[2] === 0x03 && data[3] === 0x04
}

/**
 * Extracts the drawing from an SFZ / P2Z archive: the first `.sfc` / `.p21`
 * entry. Attribute (SAF) and image files bundled with it are ignored.
 */
export function unzipSxf(data: Uint8Array): Uint8Array {
  const entries = unzipSync(data, {
    filter: file => /\.(sfc|p21)$/i.test(file.name)
  })
  const names = Object.keys(entries).sort()
  if (names.length === 0) {
    throw new Error('The archive contains no SXF (.sfc / .p21) file')
  }
  return entries[names[0]]
}

/** Converts SXF file bytes (SFC, P21 or their ZIP forms SFZ / P2Z) to DXF text. */
export function convertSxfToDxf(
  data: Uint8Array,
  options: SxfDxfOptions = {}
): SxfConversionResult {
  const text = decodeSxfBytes(isZip(data) ? unzipSxf(data) : data)
  const format = detectSxfFormat(text)
  if (format === 'sfc') {
    const drawing = readSfcDrawing(text)
    return {
      dxf: sxfDrawingToDxf(drawing, options),
      format,
      warnings: drawing.warnings
    }
  }
  if (format === 'p21') {
    const drawing = readP21Drawing(text)
    return { dxf: sxfDrawingToDxf(drawing, options), format, warnings: drawing.warnings }
  }
  throw new Error('Not an SXF (SFC / P21) file')
}
