import {
  AcDbCircle,
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbEntity,
  acdbHostApplicationServices,
  AcDbLine,
  AcDbPoint,
  AcDbText
} from '@mlightcad/data-model'
import * as ezjww from 'ezjww'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { AcDbJwwConverter } from '../src/AcDbJwwConverter'
import { convertJwwToDxf, jwwTextFontMetrics } from '../src/jwwToDxf'

/** Fixture bytes, optionally with layer group 0 set to another scale. */
function fixture(name: string, groupScale?: number) {
  const bytes = new Uint8Array(readFileSync(resolve(__dirname, 'fixtures', name)))
  if (groupScale !== undefined) {
    new DataView(bytes.buffer).setFloat32(1797, groupScale, true)
  }
  return bytes
}

async function open(bytes: Uint8Array) {
  AcDbDatabaseConverterManager.instance.register(
    'jwc',
    new AcDbJwwConverter({ useWorker: false })
  )
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  await db.read(bytes.slice().buffer, { fileName: 'drawing.jwc' }, 'jwc')
  return [...db.tables.blockTable.modelSpace.newIterator()] as AcDbEntity[]
}

beforeAll(() => {
  ezjww.initSync(readFileSync(require.resolve('ezjww/wasm/ezjww_wasm_bg.wasm')))
})

afterAll(() => {
  AcDbDatabaseConverterManager.instance.unregister('jwc')
})

describe('JWC (old Jw_cad format)', () => {
  it('converts to DXF with the A1 sheet as drawing limits', () => {
    const { dxf } = convertJwwToDxf(ezjww, fixture('q070.jwc'))
    expect(dxf).toContain('9\n$LIMMIN\n10\n-420.5\n20\n-297\n')
    expect(dxf).toContain('9\n$LIMMAX\n10\n420.5\n20\n297\n')
    // Layer "0" of group 0 is renamed like JWW layers.
    expect(dxf).toContain('8\n0-0 0\n')
  })

  it('opens line, circle, text and point records', async () => {
    const entities = await open(fixture('q070.jwc'))
    expect(entities).toHaveLength(4)
    for (const type of [AcDbCircle, AcDbLine, AcDbPoint, AcDbText]) {
      expect(entities.some(e => e instanceof type)).toBe(true)
    }
    const circle = entities.find((e): e is AcDbCircle => e instanceof AcDbCircle)
    expect(circle!.radius).toBeCloseTo(7, 4)
  })

  it('scales by the layer group and corrects the text height', async () => {
    const entities = await open(fixture('q070.jwc', 100))
    const circle = entities.find((e): e is AcDbCircle => e instanceof AcDbCircle)
    expect(circle!.radius).toBeCloseTo(700, 2)
    // Text preset 3: 3 mm cell on paper → 300 mm, drawn as BIZ UD Gothic.
    const text = entities.find((e): e is AcDbText => e instanceof AcDbText)
    expect(text!.height).toBeCloseTo(300 * jwwTextFontMetrics('').capHeight, 4)
    expect(text!.styleName).toBe('STANDARD')

    const { dxf } = convertJwwToDxf(ezjww, fixture('q070.jwc', 100))
    expect(dxf).toContain('9\n$LIMMAX\n10\n42050\n20\n29700\n')
  })

  it('decodes Japanese (CP932) text', async () => {
    const texts = (await open(fixture('r001.jwc'))).filter(
      (e): e is AcDbText => e instanceof AcDbText
    )
    expect(texts.map(t => t.textString)).toEqual(['ABC', '日本B', 'Z'])
  })
})
