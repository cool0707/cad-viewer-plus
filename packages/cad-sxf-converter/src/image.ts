import * as UTIF from 'utif2'

/** An image file ready for the browser (TIFF is converted to BMP). */
export interface SxfImageFile {
  /** File name as referenced by the drawing. */
  name: string
  data: Uint8Array
  mimeType: string
}

/**
 * Longest side of a converted TIFF. Scanned SXF images (A1 at 400 dpi is
 * about 13000 × 9000 pixels) are reduced to keep the GPU texture small.
 */
const MAX_SIDE = 4096

/** Key that matches a referenced image name to a file in the archive. */
export function sxfImageKey(name: string) {
  return (name.split(/[\\/]/).pop() ?? '').toLowerCase()
}

/**
 * Prepares a bundled image for display. SXF allows TIFF (monochrome G4) and
 * JPEG; browsers cannot show TIFF, so it is decoded and written as BMP.
 * Returns undefined for data that is not a readable image.
 */
export function sxfDisplayImage(
  name: string,
  data: Uint8Array
): SxfImageFile | undefined {
  if (data[0] === 0xff && data[1] === 0xd8) {
    return { name, data, mimeType: 'image/jpeg' }
  }
  if (data[0] === 0x89 && data[1] === 0x50) {
    return { name, data, mimeType: 'image/png' }
  }
  const tiff =
    (data[0] === 0x49 && data[1] === 0x49) ||
    (data[0] === 0x4d && data[1] === 0x4d)
  if (!tiff) return undefined
  try {
    const bmp = tiffToBmp(data)
    return bmp ? { name, data: bmp, mimeType: 'image/bmp' } : undefined
  } catch {
    return undefined
  }
}

/** Decodes the first page of a TIFF and writes it as an uncompressed BMP. */
export function tiffToBmp(data: Uint8Array): Uint8Array | undefined {
  const buffer = data.buffer.slice(
    data.byteOffset,
    data.byteOffset + data.byteLength
  ) as ArrayBuffer
  const [ifd] = UTIF.decode(buffer)
  if (!ifd) return undefined
  UTIF.decodeImage(buffer, ifd)
  const { width, height } = ifd
  if (!(width > 0) || !(height > 0)) return undefined
  const tag = (name: string, fallback: number) => {
    const value = ifd[name] as number[] | undefined
    return value?.[0] ?? fallback
  }
  const bits = tag('t258', 1)
  const samples = tag('t277', 1)
  if (bits === 1 && samples === 1) {
    // 0 = WhiteIsZero (the usual G4 fax setting), 1 = BlackIsZero.
    const whiteIsZero = tag('t262', 0) === 0
    return bilevelBmp(ifd.data, width, height, whiteIsZero)
  }
  return rgbaBmp(UTIF.toRGBA8(ifd), width, height)
}

/** 1-bit pixels (rows byte-aligned, MSB first) as BMP, reduced when large. */
function bilevelBmp(
  pixels: Uint8Array,
  width: number,
  height: number,
  whiteIsZero: boolean
) {
  const rowBytes = Math.ceil(width / 8)
  const bit = (x: number, y: number) =>
    (pixels[y * rowBytes + (x >> 3)] >> (7 - (x & 7))) & 1
  const factor = Math.ceil(Math.max(width, height) / MAX_SIDE)

  if (factor <= 1) {
    const palette = whiteIsZero ? [0xffffff, 0x000000] : [0x000000, 0xffffff]
    return writeBmp(width, height, 1, palette, (row, y) => {
      row.set(pixels.subarray(y * rowBytes, (y + 1) * rowBytes))
    })
  }

  // Box-filter to 8-bit grey so thin lines stay visible.
  const w = Math.ceil(width / factor)
  const h = Math.ceil(height / factor)
  const palette = Array.from({ length: 256 }, (_, i) => i * 0x010101)
  return writeBmp(w, h, 8, palette, (row, y) => {
    for (let x = 0; x < w; x++) {
      let ink = 0
      let count = 0
      for (let sy = y * factor; sy < Math.min(height, (y + 1) * factor); sy++) {
        for (
          let sx = x * factor;
          sx < Math.min(width, (x + 1) * factor);
          sx++
        ) {
          ink += bit(sx, sy) === (whiteIsZero ? 1 : 0) ? 1 : 0
          count++
        }
      }
      row[x] = Math.round(255 * (1 - ink / count))
    }
  })
}

function rgbaBmp(rgba: Uint8Array, width: number, height: number) {
  const factor = Math.ceil(Math.max(width, height) / MAX_SIDE)
  const w = Math.ceil(width / factor)
  const h = Math.ceil(height / factor)
  return writeBmp(w, h, 24, [], (row, y) => {
    for (let x = 0; x < w; x++) {
      const i = (y * factor * width + x * factor) * 4
      // BMP stores BGR; transparent pixels become white paper.
      const a = rgba[i + 3] / 255
      row[x * 3] = Math.round(rgba[i + 2] * a + 255 * (1 - a))
      row[x * 3 + 1] = Math.round(rgba[i + 1] * a + 255 * (1 - a))
      row[x * 3 + 2] = Math.round(rgba[i] * a + 255 * (1 - a))
    }
  })
}

/**
 * Writes a bottom-up BMP. `fillRow` receives the zeroed row buffer and the
 * image row (0 = top).
 */
function writeBmp(
  width: number,
  height: number,
  bitsPerPixel: 1 | 8 | 24,
  palette: number[],
  fillRow: (row: Uint8Array, y: number) => void
) {
  const stride = Math.ceil((width * bitsPerPixel) / 32) * 4
  const offset = 54 + palette.length * 4
  const bytes = new Uint8Array(offset + stride * height)
  const view = new DataView(bytes.buffer)
  bytes[0] = 0x42
  bytes[1] = 0x4d
  view.setUint32(2, bytes.length, true)
  view.setUint32(10, offset, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, bitsPerPixel, true)
  view.setUint32(34, stride * height, true)
  view.setUint32(46, palette.length, true)
  palette.forEach((rgb, i) => {
    bytes[54 + i * 4] = rgb & 0xff
    bytes[54 + i * 4 + 1] = (rgb >> 8) & 0xff
    bytes[54 + i * 4 + 2] = (rgb >> 16) & 0xff
  })
  const row = new Uint8Array(stride)
  for (let y = 0; y < height; y++) {
    row.fill(0)
    fillRow(row, y)
    bytes.set(row, offset + (height - 1 - y) * stride)
  }
  return bytes
}
