import { gunzipSync } from 'fflate'

/** Prefix of a Jw_cad image placement text (`^@BM<path>,<width>,<height>,…`). */
const IMAGE_PREFIX = '^@BM'

/** Path prefix Jw_cad uses for images stored inside the JWW file. */
const EMBEDDED_PREFIX = '%temp%'

/** Extra parameters Jw_cad writes for an untrimmed image. */
const DEFAULT_EXTRA = ['0', '0', '1', '0', '255', '255', '255']

/** A `^@BM` image placement text, sizes in paper millimetres. */
export interface JwwImageReference {
  /** Path as written by Jw_cad (`%temp%` prefix for embedded images). */
  path: string
  width: number
  height: number
  /** True when trimming or other parameters differ from Jw_cad's defaults. */
  hasExtra: boolean
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
  return {
    path,
    width,
    height,
    hasExtra: extra.some((value, i) => value !== (DEFAULT_EXTRA[i] ?? ''))
  }
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
