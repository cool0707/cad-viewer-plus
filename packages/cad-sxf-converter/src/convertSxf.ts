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

/** Converts SXF file bytes (SFC) to DXF text. */
export function convertSxfToDxf(
  data: Uint8Array,
  options: SxfDxfOptions = {}
): SxfConversionResult {
  const text = decodeSxfBytes(data)
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
    throw new Error('SXF P21 files are not supported yet')
  }
  throw new Error('Not an SXF (SFC / P21) file')
}
