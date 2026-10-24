import { gunzipSync } from 'fflate'

/** Prefix of a Jw_cad image placement text (`^@BM<path>,<width>,<height>,…`). */
const IMAGE_PREFIX = '^@BM'

/** Path prefix Jw_cad uses for images stored inside the JWW file. */
const EMBEDDED_PREFIX = '%temp%'

/**
 * Parameters Jw_cad writes after the trimming ones (`…,0,255,255,255`); their
 * meaning (likely rotation and transparent colour) is unknown.
 */
const DEFAULT_OTHER = ['0', '255', '255', '255']

/**
 * Trimmed part of an image (`^@BM<path>,<w>,<h>,<left>,<bottom>,<scale>,…`),
 * all as fractions of the whole image's width: Jw_cad keeps the trimmed part
 * where it was and moves the text point to its lower-left corner.
 */
export interface JwwImageTrim {
  /** Left edge, from the image's left edge. */
  left: number
  /** Bottom edge, from the image's bottom edge. */
  bottom: number
  /** Width of the trimmed part (= placement width / whole image width). */
  width: number
}

/** A `^@BM` image placement text, sizes in paper millimetres. */
export interface JwwImageReference {
  /** Path as written by Jw_cad (`%temp%` prefix for embedded images). */
  path: string
  width: number
  height: number
  /** Set when only part of the image is shown. */
  trim?: JwwImageTrim
  /** True when parameters other than trimming differ from Jw_cad's defaults. */
  hasExtra: boolean
}

/** Pixel rectangle of an image, `y` from the top row. */
export interface JwwPixelRect {
  x: number
  y: number
  width: number
  height: number
}

/** An image file stored in the JWW file (decompressed). */
export interface JwwImageFile {
  name: string
  data: Uint8Array
}

/** Parses a `^@BM` text; undefined when the text is not an image placement. */
export function parseJwwImageReference(
  content: string
): JwwImageReference | undefined {
  if (!content.startsWith(IMAGE_PREFIX)) return undefined
  const parts = content.slice(IMAGE_PREFIX.length).split(',')
  const width = Number(parts[1])
  const height = Number(parts[2])
  const path = parts[0].trim()
  if (!path || !(width > 0) || !(height > 0)) return undefined
  const extra = parts.slice(3).map(s => s.trim())
  const [left, bottom, scale] = extra.slice(0, 3).map(Number)
  const trim =
    scale > 0 && (scale !== 1 || left !== 0 || bottom !== 0)
      ? { left: left || 0, bottom: bottom || 0, width: scale }
      : undefined
  const other = extra.slice(3)
  return {
    path,
    width,
    height,
    ...(trim ? { trim } : {}),
    hasExtra: other.some((value, i) => value !== (DEFAULT_OTHER[i] ?? ''))
  }
}

/**
 * Pixels of an image of `imageWidth` × `imageHeight` pixels that a trimmed
 * placement of `width` × `height` millimetres shows; undefined when the
 * trimmed part is empty.
 */
export function jwwTrimPixelRect(
  reference: Pick<JwwImageReference, 'width' | 'height'>,
  trim: JwwImageTrim,
  imageWidth: number,
  imageHeight: number
): JwwPixelRect | undefined {
  // Everything is relative to the whole image's width, in pixels.
  const left = clamp(Math.round(trim.left * imageWidth), 0, imageWidth)
  const right = clamp(
    Math.round((trim.left + trim.width) * imageWidth),
    left,
    imageWidth
  )
  const heightRatio = (reference.height / reference.width) * trim.width
  const bottom = clamp(Math.round(trim.bottom * imageWidth), 0, imageHeight)
  const top = clamp(
    Math.round((trim.bottom + heightRatio) * imageWidth),
    bottom,
    imageHeight
  )
  if (right === left || top === bottom) return undefined
  return {
    x: left,
    y: imageHeight - top,
    width: right - left,
    height: top - bottom
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

/**
 * A trimmed part of an image the browser decodes (PNG, JPEG, GIF, …), cut out
 * asynchronously by {@link cropJwwImage}.
 */
export interface JwwImageCrop {
  /** Name of the trimmed image file. */
  name: string
  /** The whole image file. */
  source: Uint8Array
  reference: Pick<JwwImageReference, 'width' | 'height'>
  trim: JwwImageTrim
}

/**
 * Cuts a trimmed part out of an image with the browser's decoder (in a page
 * or a worker). JPEG stays JPEG, other formats become PNG. Undefined when the
 * image cannot be decoded or there is no OffscreenCanvas (e.g. in Node).
 */
export async function cropJwwImage(crop: JwwImageCrop) {
  if (
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas !== 'function'
  ) {
    return undefined
  }
  try {
    const type = imageMimeType(crop.source, crop.name)
    const bitmap = await createImageBitmap(
      new Blob([crop.source as BlobPart], { type })
    )
    try {
      const rect = jwwTrimPixelRect(
        crop.reference,
        crop.trim,
        bitmap.width,
        bitmap.height
      )
      const canvas = rect && new OffscreenCanvas(rect.width, rect.height)
      const context = canvas?.getContext('2d')
      if (!rect || !canvas || !context) return undefined
      context.drawImage(
        bitmap,
        rect.x,
        rect.y,
        rect.width,
        rect.height,
        0,
        0,
        rect.width,
        rect.height
      )
      const blob = await canvas.convertToBlob(
        type === 'image/jpeg' ? { type, quality: 0.95 } : { type: 'image/png' }
      )
      return new Uint8Array(await blob.arrayBuffer())
    } finally {
      bitmap.close()
    }
  } catch {
    return undefined
  }
}

/** Size of an uncompressed Windows BMP, or undefined for other images. */
export function bmpSize(data: Uint8Array) {
  const bmp = readBmp(data)
  return bmp ? { width: bmp.width, height: bmp.height } : undefined
}

/**
 * Cuts `rect` out of an uncompressed Windows BMP (1/4/8/16/24/32 bits) and
 * returns it as a 24-bit BMP; undefined for other images.
 */
export function cropBmp(data: Uint8Array, rect: JwwPixelRect) {
  const bmp = readBmp(data)
  if (!bmp) return undefined
  const { x, y, width, height } = rect
  if (
    width <= 0 ||
    height <= 0 ||
    x < 0 ||
    y < 0 ||
    x + width > bmp.width ||
    y + height > bmp.height
  ) {
    return undefined
  }
  const stride = Math.ceil((width * 3) / 4) * 4
  const size = 54 + stride * height
  const out = new Uint8Array(size)
  const view = new DataView(out.buffer)
  out[0] = 0x42
  out[1] = 0x4d
  view.setUint32(2, size, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  view.setUint32(34, stride * height, true)
  // Bottom-up rows, like the source BMP usually is.
  for (let row = 0; row < height; row++) {
    const offset = 54 + (height - 1 - row) * stride
    for (let col = 0; col < width; col++) {
      const [r, g, b] = bmp.pixel(x + col, y + row)
      out[offset + col * 3] = b
      out[offset + col * 3 + 1] = g
      out[offset + col * 3 + 2] = r
    }
  }
  return out
}

/** Minimal reader of uncompressed (BI_RGB / BI_BITFIELDS) BMP files. */
function readBmp(data: Uint8Array) {
  if (data.length < 54 || data[0] !== 0x42 || data[1] !== 0x4d) return undefined
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength)
  const pixelOffset = view.getUint32(10, true)
  const headerSize = view.getUint32(14, true)
  if (headerSize < 40) return undefined
  const width = view.getInt32(18, true)
  const rawHeight = view.getInt32(22, true)
  const bits = view.getUint16(28, true)
  const compression = view.getUint32(30, true)
  const height = Math.abs(rawHeight)
  if (width <= 0 || height === 0) return undefined
  if (![1, 4, 8, 16, 24, 32].includes(bits)) return undefined
  // 3 = BI_BITFIELDS (masks after a 40-byte header), 6 = with alpha mask.
  if (compression !== 0 && compression !== 3 && compression !== 6) {
    return undefined
  }
  const stride = Math.ceil((width * bits) / 32) * 4
  if (pixelOffset + stride * height > data.length) return undefined

  const paletteOffset = 14 + headerSize
  // Bit field masks follow the 40-byte core of the header (inside V4 / V5).
  const masks =
    compression === 0
      ? bits === 16
        ? [0x7c00, 0x03e0, 0x001f]
        : [0xff0000, 0x00ff00, 0x0000ff]
      : [0, 1, 2].map(i => view.getUint32(54 + i * 4, true))
  const channel = (value: number, mask: number) => {
    if (mask === 0) return 0
    let shift = 0
    while (((mask >>> shift) & 1) === 0) shift++
    const max = mask >>> shift
    return Math.round((((value & mask) >>> shift) * 255) / max)
  }
  const bottomUp = rawHeight > 0

  const pixel = (px: number, py: number): [number, number, number] => {
    const row = pixelOffset + (bottomUp ? height - 1 - py : py) * stride
    if (bits <= 8) {
      const bit = px * bits
      const byte = data[row + (bit >> 3)]
      const index = (byte >> (8 - bits - (bit & 7))) & ((1 << bits) - 1)
      const entry = paletteOffset + index * 4
      if (entry + 2 >= pixelOffset) return [0, 0, 0]
      return [data[entry + 2], data[entry + 1], data[entry]]
    }
    if (bits === 24) {
      const i = row + px * 3
      return [data[i + 2], data[i + 1], data[i]]
    }
    const value =
      bits === 16
        ? view.getUint16(row + px * 2, true)
        : view.getUint32(row + px * 4, true)
    return [
      channel(value, masks[0]),
      channel(value, masks[1]),
      channel(value, masks[2])
    ]
  }
  return { width, height, pixel }
}

/**
 * Name shown for a referenced image: the file name for embedded images, the
 * full path otherwise (so a missing external file can be identified).
 */
export function jwwImageDisplayPath(path: string) {
  return path.toLowerCase().startsWith(EMBEDDED_PREFIX)
    ? path.slice(EMBEDDED_PREFIX.length)
    : path
}

/** Key that matches an image path to an embedded file name. */
export function jwwImageKey(path: string) {
  const base = jwwImageDisplayPath(path).split(/[\\/]/).pop() ?? ''
  return base.replace(/\.gz$/i, '').toLowerCase()
}

/** Decodes ezjww's embedded images (base64, optionally gzip-compressed). */
export function decodeJwwImages(
  images: { name: string; data: string; compressed: boolean }[]
): JwwImageFile[] {
  const result: JwwImageFile[] = []
  for (const image of images) {
    try {
      const bytes = base64ToBytes(image.data)
      result.push({
        name: image.name.replace(/\.gz$/i, ''),
        data: image.compressed ? gunzipSync(bytes) : bytes
      })
    } catch {
      // A damaged image is left out; its placement shows as a missing image.
    }
  }
  return result
}

function base64ToBytes(base64: string) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

/** MIME type of an image by its signature (falls back to the extension). */
export function imageMimeType(data: Uint8Array, name = '') {
  const b = data
  if (b[0] === 0x42 && b[1] === 0x4d) return 'image/bmp'
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e) return 'image/png'
  if (b[0] === 0xff && b[1] === 0xd8) return 'image/jpeg'
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif'
  const ext = name.split('.').pop()?.toLowerCase()
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg'
  if (ext === 'png' || ext === 'gif' || ext === 'bmp') return `image/${ext}`
  return 'application/octet-stream'
}
