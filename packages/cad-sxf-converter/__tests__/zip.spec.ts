import { zipSync } from 'fflate'
import { readFileSync } from 'fs'
import { resolve } from 'path'

import { convertSxfToDxf, isZip, unzipSxf } from '../src/convertSxf'

const SAMPLES = resolve(__dirname, '../../../resources/cad-data/samples')
const sample = (name: string) => new Uint8Array(readFileSync(resolve(SAMPLES, name)))

describe('SFZ / P2Z', () => {
  it('reads the drawing inside the archives', () => {
    expect(isZip(sample('sxf-sample.sfz'))).toBe(true)
    expect(unzipSxf(sample('sxf-sample.sfz'))).toEqual(sample('sxf-sample.sfc'))
    expect(unzipSxf(sample('sxf-sample.p2z'))).toEqual(sample('sxf-sample.p21'))

    const sfz = convertSxfToDxf(sample('sxf-sample.sfz'))
    expect(sfz.format).toBe('sfc')
    expect(sfz.dxf).toBe(convertSxfToDxf(sample('sxf-sample.sfc')).dxf)
    const p2z = convertSxfToDxf(sample('sxf-sample.p2z'))
    expect(p2z.format).toBe('p21')
    expect(p2z.dxf).toBe(convertSxfToDxf(sample('sxf-sample.p21')).dxf)
  })

  it('ignores attribute files and rejects archives without a drawing', () => {
    const bundle = zipSync({
      'DRAWING.SAF': new TextEncoder().encode('attributes'),
      'DRAWING.SFC': sample('sxf-sample.sfc')
    })
    expect(unzipSxf(bundle)).toEqual(sample('sxf-sample.sfc'))
    const empty = zipSync({ 'readme.txt': new Uint8Array([1]) })
    expect(() => convertSxfToDxf(empty)).toThrow(/no SXF/)
  })
})
