import {
  AcDbDatabaseConverterManager,
  AcDbNativeDxfConverter
} from '@mlightcad/data-model'

import {
  acapDrawingFileAccept,
  acapDrawingFileType,
  acapDrawingFileTypes,
  acapIsDrawingFileName,
  acapStripDrawingExtension
} from '../src/app/AcApDrawingFileTypes'
import { markupSidecarFileName } from '../src/command/markup/AcApMarkupSidecar'

describe('AcApDrawingFileTypes', () => {
  afterEach(() => {
    AcDbDatabaseConverterManager.instance.unregister('jww')
  })

  it('always accepts DWG and DXF', () => {
    expect(acapDrawingFileTypes()).toEqual(
      expect.arrayContaining(['dwg', 'dxf'])
    )
    expect(acapDrawingFileType('Plan.DWG')).toBe('dwg')
    expect(acapDrawingFileType('plan.dxf')).toBe('dxf')
    expect(acapIsDrawingFileName('plan.jww')).toBe(false)
    expect(acapDrawingFileType('plan')).toBeUndefined()
    expect(acapDrawingFileType('plan.dxf.txt')).toBeUndefined()
  })

  it('adds formats registered with the converter manager', () => {
    AcDbDatabaseConverterManager.instance.register(
      'jww',
      new AcDbNativeDxfConverter()
    )
    expect(acapDrawingFileType('平面図.JWW')).toBe('jww')
    expect(acapDrawingFileAccept().split(',')).toEqual(
      expect.arrayContaining(['.dwg', '.dxf', '.jww'])
    )
    expect(acapStripDrawingExtension('平面図.jww')).toBe('平面図')
    expect(markupSidecarFileName('平面図.jww')).toBe('平面図.markup.json')
  })

  it('keeps unknown extensions when stripping', () => {
    expect(acapStripDrawingExtension('notes.txt')).toBe('notes.txt')
    expect(acapStripDrawingExtension('plan.dwg')).toBe('plan')
  })
})
