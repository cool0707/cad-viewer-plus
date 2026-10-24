import { unzipSync } from 'fflate'

import type { SxfDrawing } from './drawing'
import { sxfDisplayImage, type SxfImageFile, sxfImageKey } from './image'
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
  /**
   * Images bundled in an SFZ / P2Z that the drawing places, by the file name
   * the `IMAGE` entities in {@link dxf} reference.
   */
  images: SxfImageFile[]
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
  return unzipSxfBundle(data).drawing
}

/** The drawing of an SFZ / P2Z and the image files bundled with it. */
export function unzipSxfBundle(data: Uint8Array) {
  const entries = unzipSync(data, {
    filter: file => /\.(sfc|p21|tiff?|jpe?g|png)$/i.test(file.name)
  })
  const names = Object.keys(entries)
    .filter(name => /\.(sfc|p21)$/i.test(name))
    .sort()
  if (names.length === 0) {
    throw new Error('The archive contains no SXF (.sfc / .p21) file')
  }
  const files = new Map<string, Uint8Array>()
  for (const [name, bytes] of Object.entries(entries)) {
    if (!/\.(sfc|p21)$/i.test(name)) files.set(sxfImageKey(name), bytes)
  }
  return { drawing: entries[names[0]], files }
}

/** Display-ready images for the placements whose files are bundled. */
function bundledImages(drawing: SxfDrawing, files: Map<string, Uint8Array>) {
  const images: SxfImageFile[] = []
  const done = new Set<string>()
  for (const { fileName } of drawing.images) {
    if (done.has(fileName)) continue
    done.add(fileName)
    const bytes = files.get(sxfImageKey(fileName))
    const image = bytes && sxfDisplayImage(fileName, bytes)
    if (image) {
      images.push(image)
    } else if (bytes) {
      drawing.warnings.push(`Image "${fileName}" could not be decoded`)
    }
  }
  return images
}

/** Converts SXF file bytes (SFC, P21 or their ZIP forms SFZ / P2Z) to DXF text. */
export function convertSxfToDxf(
  data: Uint8Array,
  options: SxfDxfOptions = {}
): SxfConversionResult {
  const bundle = isZip(data) ? unzipSxfBundle(data) : undefined
  const text = decodeSxfBytes(bundle?.drawing ?? data)
  const format = detectSxfFormat(text)
  if (!format) throw new Error('Not an SXF (SFC / P21) file')
  const drawing = format === 'sfc' ? readSfcDrawing(text) : readP21Drawing(text)
  const images = bundledImages(drawing, bundle?.files ?? new Map())
  return {
    dxf: sxfDrawingToDxf(drawing, options),
    format,
    warnings: drawing.warnings,
    images
  }
}
