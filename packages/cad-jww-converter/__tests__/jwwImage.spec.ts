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
  decodeJwwImages,
  imageMimeType,
  jwwImageKey,
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
      parseJwwImageReference('^@BM%temp%a.bmp,100,50,0.2,0.1,0.5,0')?.hasExtra
    ).toBe(true)
    expect(parseJwwImageReference('^@BMa.bmp,0,50')).toBeUndefined()
    expect(parseJwwImageReference('文字')).toBeUndefined()
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
})
