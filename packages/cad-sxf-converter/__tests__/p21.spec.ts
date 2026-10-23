import {
  AcDbDatabase,
  AcDbDatabaseConverterManager,
  AcDbEntity,
  acdbHostApplicationServices,
  AcDbText
} from '@mlightcad/data-model'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { AcDbSxfConverter } from '../src/AcDbSxfConverter'
import { convertSxfToDxf, detectSxfFormat } from '../src/convertSxf'
import { readP21Drawing, readP21Records } from '../src/p21'
import { readSfcDrawing } from '../src/sfc'
import { decodeStepString, decodeSxfBytes } from '../src/step'

const SAMPLES = resolve(__dirname, '../../../resources/cad-data/samples')
const sampleBytes = (name: string) =>
  new Uint8Array(readFileSync(resolve(SAMPLES, name)))
const sampleText = (name: string) => decodeSxfBytes(sampleBytes(name))

async function open(name: string, type: string) {
  AcDbDatabaseConverterManager.instance.register(type, new AcDbSxfConverter())
  const db = new AcDbDatabase()
  acdbHostApplicationServices().workingDatabase = db
  await db.read(sampleBytes(name).slice().buffer, { fileName: name }, type)
  return [...db.tables.blockTable.modelSpace.newIterator()] as AcDbEntity[]
}

afterAll(() => {
  AcDbDatabaseConverterManager.instance.unregister('sfc')
  AcDbDatabaseConverterManager.instance.unregister('p21')
})

describe('P21 (AP202)', () => {
  it('decodes STEP string escapes', () => {
    expect(decodeStepString('\\X2\\901A308A82AF\\X0\\')).toBe('通り芯')
    expect(decodeStepString('\\X4\\0001F600\\X0\\')).toBe('😀')
    expect(decodeStepString('A\\X\\E9')).toBe('Aé')
  })

  it('reads complex records and detects the format', () => {
    const text = sampleText('sxf-sample.p21')
    expect(detectSxfFormat(text)).toBe('p21')
    const records = readP21Records(text)
    const complex = [...records.values()].find(r => r.has('STYLED_ITEM') && r.has('ANNOTATION_OCCURRENCE'))
    expect(complex).toBeDefined()
  })

  it('produces the same drawing as the SFC version of the sample', () => {
    const p21 = readP21Drawing(sampleText('sxf-sample.p21'))
    const sfc = readSfcDrawing(sampleText('sxf-sample.sfc'))
    expect(p21.sheet).toEqual({ name: 'A3_horizontal', width: 420, height: 297 })
    expect(p21.paths).toHaveLength(sfc.paths.length)
    expect(p21.fills).toHaveLength(sfc.fills.length)
    expect(p21.paths.filter(p => p.curve)).toHaveLength(sfc.paths.filter(p => p.curve).length)
    const texts = (d: typeof p21) =>
      d.texts.map(t => [t.text, t.anchor.map(v => Number(v.toFixed(6))), t.height, t.width, t.basePoint, t.style.layer, t.style.font])
    expect(texts(p21)).toEqual(texts(sfc))
    const layers = (d: typeof p21) => [...new Set(d.paths.map(p => p.style.layer))].sort()
    expect(layers(p21)).toEqual(layers(sfc))
  })

  it('opens through the converter in real millimetres', async () => {
    const entities = await open('sxf-sample.p21', 'p21')
    const room = entities.find(
      (e): e is AcDbText => e instanceof AcDbText && e.textString === '居間・食堂'
    )
    expect(room).toBeDefined()
    expect(room!.layer).toBe('文字')
    const sfcEntities = await open('sxf-sample.sfc', 'sfc')
    expect(entities).toHaveLength(sfcEntities.length)
    const { dxf } = convertSxfToDxf(sampleBytes('sxf-sample.p21'))
    expect(dxf).toContain('9\n$LIMMAX\n10\n42000\n20\n29700\n')
  })
})
