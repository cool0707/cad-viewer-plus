import {
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  acdbHostApplicationServices,
  AcDbRasterImage
} from '@mlightcad/data-model'
import { strToU8, unzipSync, zipSync } from 'fflate'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { AcDbSxfConverter } from '../src/AcDbSxfConverter'
import { convertSxfToDxf } from '../src/convertSxf'
import { sxfImageFileName } from '../src/drawing'
import { sxfDisplayImage, tiffToBmp } from '../src/image'

const SAMPLES = resolve(__dirname, '../../../resources/cad-data/samples')
const sample = (name: string) =>
  new Uint8Array(readFileSync(resolve(SAMPLES, name)))
const fixture = (name: string) =>
  new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)))

/** Reads a 1-, 8- or 24-bit bottom-up BMP into grey levels. */
function readBmp(bmp: Uint8Array) {
  const view = new DataView(bmp.buffer, bmp.byteOffset, bmp.byteLength)
  const offset = view.getUint32(10, true)
  const width = view.getInt32(18, true)
  const height = view.getInt32(22, true)
  const bits = view.getUint16(28, true)
  const stride = Math.ceil((width * bits) / 32) * 4
  const palette = (i: number) => bmp[54 + i * 4]
  const grey = (x: number, y: number) => {
    const row = offset + (height - 1 - y) * stride
    if (bits === 1) return palette((bmp[row + (x >> 3)] >> (7 - (x & 7))) & 1)
    if (bits === 8) return palette(bmp[row + x])
    return bmp[row + x * 3]
  }
  return { width, height, bits, grey }
}

async function open(name: string) {
  AcDbDatabaseConverterManager.instance.register(
    name.split('.').pop()!,
    new AcDbSxfConverter()
  )
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  const bytes = sample(name)
  await db.read(
    bytes.slice().buffer,
    { fileName: name },
    name.split('.').pop()!
  )
  return [...db.tables.blockTable.modelSpace.newIterator()].filter(
    (e): e is AcDbRasterImage => e instanceof AcDbRasterImage
  )
}

afterAll(() => {
  for (const type of ['sfc', 'p21', 'sfz', 'p2z']) {
    AcDbDatabaseConverterManager.instance.unregister(type)
  }
})

describe('SXF image attributes', () => {
  it('reads the file name of an image attribute', () => {
    expect(sxfImageFileName('$$ATRU$$1$$image$$画像$$MAP.TIF$$STR')).toBe(
      'MAP.TIF'
    )
    expect(sxfImageFileName('$$SXF_G_$$ATRU$$7$$fig$$画像$$a.jpg')).toBe(
      'a.jpg'
    )
    expect(sxfImageFileName('$$ATRU$$1$$fig$$材料$$鋼$$STR')).toBeUndefined()
    expect(sxfImageFileName('平面図')).toBeUndefined()
  })

  it('places images in SFC and P21 alike and bundles them in SFZ / P2Z', async () => {
    for (const name of [
      'sxf-sample.sfc',
      'sxf-sample.p21',
      'sxf-sample.sfz',
      'sxf-sample.p2z'
    ]) {
      const images = await open(name)
      expect(images).toHaveLength(1)
      const [image] = images
      expect(image.imageFileName).toBe('SXF-MAP.TIF')
      // 80 x 60 mm at (320, 200) on the sheet; the main view is 1/100.
      expect(image.position.x).toBeCloseTo(32000, 6)
      expect(image.position.y).toBeCloseTo(20000, 6)
      expect(image.width).toBeCloseTo(8000, 6)
      expect(image.height).toBeCloseTo(6000, 6)
      expect(image.rotation).toBeCloseTo(0, 9)
      // Only the archives carry the TIFF; it becomes a BMP for the browser.
      if (/\.(sfz|p2z)$/.test(name)) {
        expect(image.image?.type).toBe('image/bmp')
      } else {
        expect(image.image).toBeUndefined()
      }
    }
  })

  it('writes the image instead of its rectangle', () => {
    const { dxf } = convertSxfToDxf(sample('sxf-sample.sfz'))
    expect(dxf).toContain('0\nIMAGE\n')
    expect(dxf).toMatch(/0\nIMAGEDEF\n(?:\d+\n[^\n]*\n)*?1\nSXF-MAP\.TIF\n/)
    // As many polylines as the sample had before it got an image.
    expect(dxf.match(/\nLWPOLYLINE\n/g)).toHaveLength(5)
  })

  it('matches bundled files case-insensitively and passes JPEG through', () => {
    const entries = unzipSync(sample('sxf-sample.sfz'))
    const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9])
    // One char per byte. TextDecoder('latin1') is windows-1252 and would turn
    // the Shift_JIS bytes 0x80-0x9F into code points above 0xFF.
    const sfc = Array.from(entries['SXF-SAMPLE.SFC'], b =>
      String.fromCharCode(b)
    )
      .join('')
      .split('SXF-MAP.TIF')
      .join('photo.jpg')
    const bundle = zipSync({
      'DRAWING.SFC': new Uint8Array([...sfc].map(c => c.charCodeAt(0))),
      'PHOTO.JPG': jpeg,
      'notes.txt': strToU8('ignored')
    })
    const { images } = convertSxfToDxf(bundle)
    expect(images).toEqual([
      { name: 'photo.jpg', data: jpeg, mimeType: 'image/jpeg' }
    ])
  })
})

describe('TIFF conversion', () => {
  it('converts monochrome G4 TIFF to a 1-bit BMP', () => {
    const tif = unzipSync(sample('sxf-sample.sfz'))['SXF-MAP.TIF']
    const bmp = readBmp(tiffToBmp(tif)!)
    expect([bmp.width, bmp.height, bmp.bits]).toEqual([640, 480, 1])
    // The map has a black 4-pixel border on white paper.
    expect(bmp.grey(0, 0)).toBe(0)
    expect(bmp.grey(10, 10)).toBe(255)
  })

  it('reduces very large images to grey levels', () => {
    // 5000 x 40: left half black, a black bar at x 4000-4999, y 10-19.
    const bmp = readBmp(tiffToBmp(fixture('wide-g4.tif'))!)
    expect([bmp.width, bmp.height, bmp.bits]).toEqual([2500, 20, 8])
    expect(bmp.grey(100, 10)).toBe(0)
    expect(bmp.grey(1600, 2)).toBe(255)
    expect(bmp.grey(2200, 7)).toBe(0)
    expect(bmp.grey(2200, 2)).toBe(255)
  })

  it('rejects data that is not an image', () => {
    expect(sxfDisplayImage('a.tif', new Uint8Array([1, 2, 3]))).toBeUndefined()
    expect(sxfDisplayImage('a.tif', strToU8('II*\0broken'))).toBeUndefined()
  })
})
