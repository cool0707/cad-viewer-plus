import {
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbEntity,
  acdbHostApplicationServices,
  AcDbRasterImage,
  AcDbText
} from '@mlightcad/data-model'
import * as ezjww from 'ezjww'
import { gzipSync } from 'fflate'
import { readFileSync } from 'fs'

import { AcDbJwwConverter } from '../src/AcDbJwwConverter'
import {
  bmpSize,
  cropBmp,
  decodeJwwImages,
  imageMimeType,
  jwwImageKey,
  jwwTrimPixelRect,
  parseJwwImageReference
} from '../src/jwwImage'
import { convertJwwToDxf } from '../src/jwwToDxf'

// 1 x 1 PNG.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
)

const base = (group: number) => ({
  group: 0,
  pen_style: 1,
  pen_color: 1,
  pen_width: 0,
  layer: 0,
  layer_group: group,
  flag: 0
})

function imageText(x: number, y: number, angle: number, content: string) {
  return {
    type: 'TEXT' as const,
    base: base(0),
    start_x: x,
    start_y: y,
    end_x: x + 10,
    end_y: y,
    text_type: 0,
    size_x: 2.5,
    size_y: 2.5,
    spacing: 0,
    angle,
    font_name: 'ＭＳ ゴシック',
    content
  }
}

/** A JWW (layer group 0 at 1/50) with two embedded and one external image. */
function imageDrawing() {
  const doc = ezjww.newJwwDocument()
  doc.options.layer_groups[0].scale = 50
  doc.entities.push(
    imageText(10, 20, 0, ezjww.imageReferenceContent('%temp%plan.png', 80, 40)),
    imageText(
      -30,
      -10,
      30,
      ezjww.imageReferenceContent('%temp%photo.bmp', 20, 10)
    ),
    imageText(0, 0, 0, '^@BMC:\\images\\site.jpg,30,20'),
    imageText(5, 5, 0, '通常の文字')
  )
  doc.images = [
    { name: 'plan.png', data: PNG.toString('base64') },
    {
      name: 'photo.bmp.gz',
      data: Buffer.from(gzipSync(PNG)).toString('base64'),
      compressed: true
    }
  ]
  const bytes = ezjww.toJwwBytes(doc)
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer
}

/** A 24-bit bottom-up BMP whose pixel (x, y from the top) is (x, y, 7). */
function gradientBmp(width: number, height: number) {
  const stride = Math.ceil((width * 3) / 4) * 4
  const data = new Uint8Array(54 + stride * height)
  const view = new DataView(data.buffer)
  data.set([0x42, 0x4d])
  view.setUint32(2, data.length, true)
  view.setUint32(10, 54, true)
  view.setUint32(14, 40, true)
  view.setInt32(18, width, true)
  view.setInt32(22, height, true)
  view.setUint16(26, 1, true)
  view.setUint16(28, 24, true)
  for (let y = 0; y < height; y++) {
    const row = 54 + (height - 1 - y) * stride
    for (let x = 0; x < width; x++) {
      data.set([7, y, x], row + x * 3)
    }
  }
  return data
}

/** Red channel (x) and green channel (y) of a 24-bit BMP pixel. */
function bmpPixel(data: Uint8Array, x: number, y: number) {
  const view = new DataView(data.buffer, data.byteOffset)
  const width = view.getInt32(18, true)
  const height = view.getInt32(22, true)
  const stride = Math.ceil((width * 3) / 4) * 4
  const i = 54 + (height - 1 - y) * stride + x * 3
  return { x: data[i + 2], y: data[i + 1] }
}

async function openImageDrawing() {
  AcDbDatabaseConverterManager.instance.register(
    'jww',
    new AcDbJwwConverter({ useWorker: false })
  )
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  await db.read(imageDrawing(), { fileName: 'images.jww' }, 'jww')
  return db
}

beforeAll(() => {
  const wasm = require.resolve('ezjww/wasm/ezjww_wasm_bg.wasm')
  ezjww.initSync(readFileSync(wasm))
})

afterAll(() => {
  AcDbDatabaseConverterManager.instance.unregister('jww')
})

describe('JWW image helpers', () => {
  it('parses ^@BM placements', () => {
    expect(parseJwwImageReference('^@BM%temp%a.bmp,100,50')).toEqual({
      path: '%temp%a.bmp',
      width: 100,
      height: 50,
      hasExtra: false
    })
    expect(
      parseJwwImageReference('^@BM%temp%a.bmp,100,50,0,0,1,0,255,255,255')
        ?.hasExtra
    ).toBe(false)
    expect(
      parseJwwImageReference('^@BM%temp%a.bmp,100,50,0.2,0.1,0.5,0')?.trim
    ).toEqual({ left: 0.2, bottom: 0.1, width: 0.5 })
    expect(
      parseJwwImageReference('^@BM%temp%a.bmp,100,50,0,0,1,0,0,0,0')?.hasExtra
    ).toBe(true)
    expect(parseJwwImageReference('^@BMa.bmp,0,50')).toBeUndefined()
    expect(parseJwwImageReference('文字')).toBeUndefined()
  })

  it('parses the trimming parameters', () => {
    // Jw_cad's own output for the middle of a 100 x 66.6667 mm image.
    expect(
      parseJwwImageReference(
        '^@BM%temp%a.bmp,64.2072,29.8105,0.154785,0.196061,0.642072,0,255,255,255'
      )
    ).toEqual({
      path: '%temp%a.bmp',
      width: 64.2072,
      height: 29.8105,
      trim: { left: 0.154785, bottom: 0.196061, width: 0.642072 },
      hasExtra: false
    })
  })

  it('maps a trim to image pixels (offsets from the lower-left corner)', () => {
    const reference = { width: 64.2072, height: 29.8105 }
    const trim = { left: 0.154785, bottom: 0.196061, width: 0.642072 }
    // 510 x 340 pixels: 100 px from the bottom, 152 px tall.
    expect(jwwTrimPixelRect(reference, trim, 510, 340)).toEqual({
      x: 79,
      y: 88,
      width: 327,
      height: 152
    })
    expect(
      jwwTrimPixelRect(reference, { left: 1, bottom: 0, width: 0.5 }, 510, 340)
    ).toBeUndefined()
  })

  it('crops BMP images', () => {
    const bmp = gradientBmp(10, 6)
    expect(bmpSize(bmp)).toEqual({ width: 10, height: 6 })
    const cropped = cropBmp(bmp, { x: 3, y: 1, width: 5, height: 4 })!
    expect(bmpSize(cropped)).toEqual({ width: 5, height: 4 })
    expect(bmpPixel(cropped, 0, 0)).toEqual({ x: 3, y: 1 })
    expect(bmpPixel(cropped, 4, 3)).toEqual({ x: 7, y: 4 })
    expect(cropBmp(bmp, { x: 8, y: 0, width: 5, height: 1 })).toBeUndefined()
    expect(cropBmp(PNG, { x: 0, y: 0, width: 1, height: 1 })).toBeUndefined()
  })

  it('matches paths to embedded names', () => {
    expect(jwwImageKey('%temp%Photo.BMP')).toBe('photo.bmp')
    expect(jwwImageKey('%TEMP%photo.bmp.gz')).toBe('photo.bmp')
    expect(jwwImageKey('C:\\img\\photo.bmp')).toBe('photo.bmp')
  })

  it('decodes base64 and gzip images', () => {
    const [plain, packed] = decodeJwwImages([
      { name: 'a.png', data: PNG.toString('base64'), compressed: false },
      {
        name: 'b.png.gz',
        data: Buffer.from(gzipSync(PNG)).toString('base64'),
        compressed: true
      }
    ])
    expect(Buffer.from(plain.data)).toEqual(PNG)
    expect(packed.name).toBe('b.png')
    expect(Buffer.from(packed.data)).toEqual(PNG)
    expect(imageMimeType(packed.data)).toBe('image/png')
  })
})

describe('JWW images', () => {
  it('writes ^@BM placements as IMAGE entities', () => {
    const result = convertJwwToDxf(ezjww, new Uint8Array(imageDrawing()))
    expect(result.dxf).toContain('0\nIMAGE\n')
    expect(result.dxf).toContain('0\nIMAGEDEF\n')
    expect(result.dxf).not.toContain('^@BM')
    expect(result.images.map(i => i.name).sort()).toEqual([
      'photo.bmp',
      'plan.png'
    ])
  })

  it('places embedded images and keeps external ones as missing', async () => {
    const db = await openImageDrawing()
    const entities = [
      ...db.tables.blockTable.modelSpace.newIterator()
    ] as AcDbEntity[]
    const images = entities.filter(
      (e): e is AcDbRasterImage => e instanceof AcDbRasterImage
    )
    expect(images).toHaveLength(3)
    const byName = new Map(images.map(i => [i.imageFileName, i]))

    // 80 x 40 mm on paper at 1/50, lower-left at the text point.
    const plan = byName.get('plan.png')!
    expect(plan.image?.type).toBe('image/png')
    expect(plan.width).toBeCloseTo(4000, 6)
    expect(plan.height).toBeCloseTo(2000, 6)
    expect(plan.position.x).toBeCloseTo(500, 6)
    expect(plan.position.y).toBeCloseTo(1000, 6)
    expect(plan.rotation).toBeCloseTo(0, 9)

    const photo = byName.get('photo.bmp')!
    expect(photo.image).toBeDefined()
    expect(photo.width).toBeCloseTo(1000, 6)
    expect(photo.rotation).toBeCloseTo(Math.PI / 6, 9)

    // Not embedded: only the path, shown as a missing image in the viewer.
    const site = byName.get('C:\\images\\site.jpg')!
    expect(site.image).toBeUndefined()
    expect(site.width).toBeCloseTo(1500, 6)

    const texts = entities.filter((e): e is AcDbText => e instanceof AcDbText)
    expect(texts.map(t => t.textString)).toEqual(['通常の文字'])
  })

  it('shows only the trimmed part of an embedded BMP', () => {
    const doc = ezjww.newJwwDocument()
    // 20 x 10 pixels shown 40 x 20 mm; the trim keeps 10 x 4 mm, 6 mm from the
    // left and 8 mm from the bottom (= pixels 3..7 x 4..5 from the top).
    const trimmed = '^@BM%temp%grad.bmp,10,4,0.15,0.2,0.25,0,255,255,255'
    doc.entities.push(
      imageText(1, 2, 0, trimmed),
      imageText(30, 2, 0, trimmed),
      imageText(60, 2, 0, ezjww.imageReferenceContent('%temp%grad.bmp', 40, 20))
    )
    doc.images = [
      {
        name: 'grad.bmp',
        data: Buffer.from(gradientBmp(20, 10)).toString('base64')
      }
    ]
    const result = convertJwwToDxf(ezjww, ezjww.toJwwBytes(doc))
    expect(result.warnings).toEqual([])
    // The same trim is cut out once.
    expect(result.images.map(i => i.name)).toEqual([
      'grad.bmp',
      'grad~trim1.bmp'
    ])
    const cropped = result.images[1].data
    expect(bmpSize(cropped)).toEqual({ width: 5, height: 2 })
    expect(bmpPixel(cropped, 0, 0)).toEqual({ x: 3, y: 4 })
    expect(bmpPixel(cropped, 4, 1)).toEqual({ x: 7, y: 5 })
    expect(result.dxf).toContain('\n1\ngrad~trim1.bmp\n')
    expect(result.dxf).toContain('\n1\ngrad.bmp\n')
  })

  it('shows other trimmed images whole, with a warning', () => {
    const doc = ezjww.newJwwDocument()
    doc.entities.push(
      imageText(0, 0, 0, '^@BMC:\\img\\a.bmp,10,4,0.15,0.2,0.25,0,255,255,255')
    )
    const result = convertJwwToDxf(ezjww, ezjww.toJwwBytes(doc))
    expect(result.images).toEqual([])
    expect(result.warnings).toHaveLength(1)
    expect(result.dxf).toContain('\n1\nC:\\img\\a.bmp\n')
  })
})
