/**
 * SXF P21 (ISO 10303-21, AP202 "associative draughting") reader.
 *
 * Walks the presentation graph from the drawing sheet: styled annotation
 * occurrences, callouts (dimensions, leaders), subfigure placements
 * (MAPPED_ITEM), text literals, fill areas and defined symbols. Ported from
 * ezsxf (MIT, https://github.com/monozukuri-ai/ezsxf,
 * `src/ezsxf/_p21_drawing.py` and the sheet lookup in `src/p21_model.rs`).
 */
import {
  type Affine,
  apply,
  applyVector,
  arcSweepDeg,
  averageScale,
  clipHatchLines,
  compose,
  ellipseCurve,
  IDENTITY,
  near,
  type Point,
  type Rgb,
  sampleCurve,
  sampleSpline,
  type SxfCurve,
  SxfDrawing,
  sxfImageFileName,
  sxfImageFromPaths,
  type SxfStyle,
  transformCurve
} from './drawing'
import {
  asNumber,
  asNumberList,
  asString,
  StepReader,
  type StepValue
} from './step'
import { normalizeSxfName, predefinedColorByName } from './style'

type Records = Map<string, StepValue[]>
type Geometry = { points: Point[]; closed: boolean }

/** Reads the DATA section of a Part 21 file into records by entity id. */
export function readP21Records(text: string): Map<number, Records> {
  const entities = new Map<number, Records>()
  const data = /\bDATA\s*;/i.exec(text)
  if (!data) throw new Error('P21 file has no DATA section')
  const reader = new StepReader(text)
  reader.index = data.index + data[0].length
  for (;;) {
    reader.skipWs()
    if (reader.eof || /^ENDSEC/i.test(text.slice(reader.index, reader.index + 6))) break
    const start = reader.index
    try {
      const entity = reader.entity()
      reader.expect(';')
      const records: Records = new Map()
      for (const record of entity.records) {
        records.set(record.keyword.toUpperCase(), record.params)
      }
      entities.set(entity.id, records)
    } catch {
      // Skip a damaged record up to the next ';'.
      const next = text.indexOf(';', Math.max(start, reader.index) + 1)
      if (next < 0) break
      reader.index = next + 1
    }
  }
  return entities
}

const ref = (v: StepValue | undefined) => (v?.kind === 'ref' ? v.id : undefined)

/** All references in a value, depth first. */
function refs(v: StepValue | StepValue[] | undefined, out: number[] = []): number[] {
  if (!v) return out
  if (Array.isArray(v)) {
    for (const item of v) refs(item, out)
  } else if (v.kind === 'ref') {
    out.push(v.id)
  } else if (v.kind === 'list') {
    refs(v.values, out)
  } else if (v.kind === 'typed') {
    refs(v.params, out)
  }
  return out
}

function firstNumber(v: StepValue | undefined): number | undefined {
  if (!v) return undefined
  if (v.kind === 'integer' || v.kind === 'real') return v.value
  if (v.kind === 'typed') {
    for (const p of v.params) {
      const n = firstNumber(p)
      if (n !== undefined) return n
    }
  }
  if (v.kind === 'list') {
    for (const p of v.values) {
      const n = firstNumber(p)
      if (n !== undefined) return n
    }
  }
  return undefined
}

function firstString(v: StepValue | undefined): string | undefined {
  if (!v) return undefined
  if (v.kind === 'string') return v.value
  if (v.kind === 'typed' || v.kind === 'list') {
    for (const p of v.kind === 'typed' ? v.params : v.values) {
      const s = firstString(p)
      if (s !== undefined) return s
    }
  }
  return undefined
}

const enumValue = (v: StepValue | undefined) =>
  v?.kind === 'enum' ? v.value.toUpperCase() : undefined

const isDummyLayer = (name: string) =>
  /dummy_layer/i.test(name) || /^\$\$sxf_dummy/i.test(name)

/** `$$SXF_FM_` / `$$SXF_FG_` subfigures are partial drawings (kinds 1, 2). */
const isPartialDrawingName = (name: string) => /^\$\$SXF_F[MG]_/i.test(name)

const STYLE_CONTAINERS = [
  'CURVE_STYLE',
  'FILL_AREA_STYLE',
  'FILL_AREA_STYLE_COLOUR',
  'FILL_AREA_STYLE_HATCHING',
  'PRESENTATION_STYLE_ASSIGNMENT',
  'SYMBOL_COLOUR',
  'SYMBOL_STYLE',
  'TEXT_STYLE',
  'TEXT_STYLE_FOR_DEFINED_FONT',
  'TEXT_STYLE_WITH_BOX_CHARACTERISTICS',
  'TEXT_STYLE_WITH_SPACING'
]

const NON_RENDERED = new Set([
  'ANNOTATION_SYMBOL',
  'AXIS2_PLACEMENT_2D',
  'CARTESIAN_POINT',
  'DIRECTION',
  'DRAUGHTING_ELEMENTS',
  'GEOMETRIC_REPRESENTATION_ITEM',
  'PLANAR_BOX',
  'REPRESENTATION_ITEM',
  'SYMBOL_REPRESENTATION_MAP',
  'SYMBOL_TARGET',
  'VECTOR'
])

interface StyleValues {
  color?: Rgb
  lineType?: string
  lineWidth?: number
  font?: string
}

/** STYLED_ITEM(name, styles, item): [style ids, target id]. */
function styledItemParts(params: StepValue[]): [number[], number | undefined] {
  const offset = params.length >= 3 && params[0].kind === 'string' ? 1 : 0
  return [refs(params[offset]), ref(params[offset + 1])]
}

const STANDARD_SHEETS: Record<string, [number, number]> = {
  A0: [1189, 841],
  A1: [841, 594],
  A2: [594, 420],
  A3: [420, 297],
  A4: [297, 210]
}

export class P21DrawingBuilder {
  readonly drawing = new SxfDrawing()
  private readonly layers = new Map<number, string>()
  private readonly hidden = new Set<number>()
  private sheetItems: number[] = []
  private readonly geometryCache = new Map<number, Geometry[]>()
  private readonly curveCache = new Map<number, SxfCurve>()
  private readonly styleCache = new Map<string, StyleValues>()
  private readonly textKeys = new Set<string>()

  constructor(
    private readonly records: Map<number, Records>,
    private readonly segments = 64
  ) {
    this.scanStructure()
  }

  build() {
    if (this.sheetItems.length === 0) {
      throw new Error('P21 drawing has no DRAWING_SHEET_REVISION')
    }
    this.renderItems(this.sheetItems, IDENTITY, undefined, true, new Set())
    return this.drawing
  }

  private get(id: number | undefined, keyword: string) {
    return id === undefined ? undefined : this.records.get(id)?.get(keyword)
  }

  private scanStructure() {
    let sheetId: number | undefined
    for (const [id, records] of this.records) {
      const layer = records.get('PRESENTATION_LAYER_ASSIGNMENT')
      if (layer && layer.length >= 3) {
        const name = asString(layer[0]) ?? ''
        for (const item of refs(layer[2])) this.layers.set(item, name)
      }
      const invisibility = records.get('INVISIBILITY')
      if (invisibility?.length) {
        for (const item of refs(invisibility[0])) this.hidden.add(item)
      }
      const sheet = records.get('DRAWING_SHEET_REVISION')
      if (sheet && sheetId === undefined) {
        sheetId = id
        this.sheetItems = refs(sheet[1])
      }
    }
    // INVISIBILITY may target a layer assignment instead of its items.
    for (const id of [...this.hidden]) {
      const layer = this.get(id, 'PRESENTATION_LAYER_ASSIGNMENT')
      if (layer && layer.length >= 3) {
        for (const item of refs(layer[2])) this.hidden.add(item)
      }
    }
    if (sheetId !== undefined) this.drawing.sheet = this.sheetSize(sheetId)
  }

  /** Sheet box: PLANAR_BOX on the sheet or via PRESENTATION_SIZE, else its name. */
  private sheetSize(sheetId: number) {
    const sheet = this.get(sheetId, 'DRAWING_SHEET_REVISION')!
    const name = asString(sheet[0]) ?? ''
    let box: StepValue[] | undefined
    for (const item of refs(sheet[1])) {
      box = this.get(item, 'PLANAR_BOX')
      if (box) break
    }
    if (!box) {
      for (const records of this.records.values()) {
        const size = records.get('PRESENTATION_SIZE')
        if (size && ref(size[0]) === sheetId) {
          box = this.get(ref(size[1]), 'PLANAR_BOX')
          break
        }
      }
    }
    if (box) {
      const width = asNumber(box[1]) ?? 0
      const height = asNumber(box[2]) ?? 0
      if (width > 0 && height > 0) return { name, width, height }
    }
    const match = /^(A[0-4])_(horizontal|vertical)/i.exec(name)
    if (match) {
      const [long, short] = STANDARD_SHEETS[match[1].toUpperCase()]
      return /horizontal/i.test(match[2])
        ? { name, width: long, height: short }
        : { name, width: short, height: long }
    }
    return undefined
  }

  private renderItems(
    ids: number[],
    t: Affine,
    layerOverride: string | undefined,
    parentVisible: boolean,
    active: Set<number>
  ) {
    const set = new Set(ids)
    const nested = new Set<number>()
    for (const id of ids) {
      const callout = this.get(id, 'DRAUGHTING_CALLOUT')
      if (callout?.length) {
        for (const child of refs(callout[0])) if (set.has(child)) nested.add(child)
      }
    }
    for (const id of ids) {
      if (!nested.has(id)) this.renderItem(id, t, layerOverride, parentVisible, active)
    }
  }

  private renderItem(
    id: number,
    t: Affine,
    layerOverride: string | undefined,
    parentVisible: boolean,
    active: Set<number>
  ) {
    if (active.has(id)) {
      this.drawing.warnOnce(`p21-cycle-${id}`, `Cyclic P21 reference at #${id} was skipped`)
      return
    }
    const records = this.records.get(id)
    if (!records) return
    const nextActive = new Set(active).add(id)
    const visible = parentVisible && !this.hidden.has(id)
    const ownLayer = this.layers.get(id)
    let nextLayer = layerOverride
    if (
      nextLayer === undefined &&
      ownLayer &&
      !isDummyLayer(ownLayer) &&
      !this.isPartialDrawingOccurrence(records)
    ) {
      nextLayer = ownLayer
    }

    const callout = records.get('DRAUGHTING_CALLOUT')
    if (callout?.length) {
      const children = refs(callout[0])
      nextLayer ??= this.findNestedLayer(children, new Set())
      for (const child of children) {
        this.renderItem(child, t, nextLayer, visible, nextActive)
      }
      return
    }

    const styled = records.get('STYLED_ITEM')
    if (styled) {
      const [styleIds, target] = styledItemParts(styled)
      if (target !== undefined) {
        const style = this.renderStyle(styleIds, nextLayer ?? '0', visible)
        this.renderTarget(target, style, t, nextLayer, id, nextActive)
        return
      }
    }

    if (records.has('MAPPED_ITEM')) {
      this.renderMappedItem(id, t, nextLayer, visible, nextActive)
      return
    }

    const representation = records.get('DRAUGHTING_SUBFIGURE_REPRESENTATION')
    if (representation) {
      this.renderItems(refs(representation[1]), t, nextLayer, visible, nextActive)
      return
    }

    if (this.geometry(id).length) {
      this.appendGeometry(id, this.renderStyle([], nextLayer ?? '0', visible), t)
      return
    }

    if (![...records.keys()].every(k => NON_RENDERED.has(k))) {
      const names = [...records.keys()].sort().join(', ')
      this.drawing.warnOnce(`p21-unsupported-${names}`, `P21 records not drawn: ${names}`)
    }
  }

  /** A styled occurrence of a partial-drawing placement keeps child layers. */
  private isPartialDrawingOccurrence(records: Records) {
    const styled = records.get('STYLED_ITEM')
    const target = styled ? styledItemParts(styled)[1] : undefined
    const mapped = target === undefined ? records.get('MAPPED_ITEM') : this.get(target, 'MAPPED_ITEM')
    if (!mapped) return false
    const map = this.get(ref(mapped[0]), 'SYMBOL_REPRESENTATION_MAP')
    const representation = map && this.get(ref(map[1]), 'DRAUGHTING_SUBFIGURE_REPRESENTATION')
    return !!representation && isPartialDrawingName(asString(representation[0]) ?? '')
  }

  private renderTarget(
    target: number,
    style: SxfStyle,
    t: Affine,
    layerOverride: string | undefined,
    source: number,
    active: Set<number>
  ) {
    const records = this.records.get(target)
    if (!records) return
    if (records.has('TEXT_LITERAL_WITH_EXTENT')) {
      this.appendText(target, style, t)
    } else if (records.has('ANNOTATION_FILL_AREA')) {
      this.appendFillArea(target, style, t, source)
    } else if (records.has('DEFINED_SYMBOL')) {
      this.appendDefinedSymbol(target, style, t, source)
    } else if (records.has('MAPPED_ITEM')) {
      this.renderMappedItem(target, t, layerOverride, style.visible, active)
    } else if (records.has('DRAUGHTING_SUBFIGURE_REPRESENTATION')) {
      const representation = records.get('DRAUGHTING_SUBFIGURE_REPRESENTATION')!
      this.renderItems(refs(representation[1]), t, layerOverride, style.visible, active)
    } else if (this.geometry(target).length) {
      this.appendGeometry(target, style, t)
    } else {
      this.renderItem(target, t, layerOverride, style.visible, active)
    }
  }

  private renderMappedItem(
    id: number,
    t: Affine,
    layerOverride: string | undefined,
    parentVisible: boolean,
    active: Set<number>
  ) {
    const mapped = this.get(id, 'MAPPED_ITEM')
    if (!mapped || mapped.length < 2) return
    const map = this.get(ref(mapped[0]), 'SYMBOL_REPRESENTATION_MAP')
    const targetId = ref(mapped[1])
    if (!map || targetId === undefined) return
    const sourceAxis = ref(map[0])
    const representationId = ref(map[1])
    if (sourceAxis === undefined || representationId === undefined) return
    const mapping = compose(
      this.symbolTargetTransform(targetId),
      inverseAffine(this.axisTransform(sourceAxis))
    )
    const representation = this.get(representationId, 'DRAUGHTING_SUBFIGURE_REPRESENTATION')
    if (!representation) return
    const render = () =>
      this.renderItems(refs(representation[1]), compose(t, mapping), layerOverride, parentVisible, active)
    const imageFile = sxfImageFileName(asString(representation[0]) ?? '')
    if (imageFile) this.renderImage(imageFile, render)
    else render()
  }

  /** Draws an image attribute's rectangle as an image (else as lines). */
  private renderImage(fileName: string, render: () => void) {
    const saved = this.drawing.paths
    this.drawing.paths = []
    render()
    const paths = this.drawing.paths
    this.drawing.paths = saved
    const image = sxfImageFromPaths(fileName, paths)
    if (image) {
      this.drawing.images.push(image)
    } else {
      this.drawing.paths.push(...paths)
      this.drawing.warnOnce(`image-shape-${fileName}`, `Image "${fileName}" has no rectangle; drawn as lines`)
    }
  }

  private appendGeometry(id: number, style: SxfStyle, t: Affine) {
    const geometry = this.geometry(id)
    const curve = geometry.length === 1 ? this.curveCache.get(id) : undefined
    for (const g of geometry) {
      if (g.points.length < 2) continue
      this.drawing.paths.push({
        points: g.points.map(p => apply(t, p)),
        closed: g.closed,
        style,
        scale: averageScale(t),
        curve: curve ? transformCurve(t, curve) : undefined
      })
    }
  }

  private appendText(id: number, style: SxfStyle, t: Affine) {
    const params = this.get(id, 'TEXT_LITERAL_WITH_EXTENT')!
    if (params.length < 7) return
    const placementId = ref(params[2])
    const extent = this.get(ref(params[6]), 'PLANAR_EXTENT')
    if (placementId === undefined || !extent || extent.length < 3) return
    const text = asString(params[1]) ?? ''
    if (!text) return
    const placement = compose(t, this.axisTransform(placementId))
    const width = Math.abs(asNumber(extent[1]) ?? 0)
    const height = Math.abs(asNumber(extent[2]) ?? 0)
    const vertical = enumValue(params[4]) === 'DOWN'
    const xVector = applyVector(placement, vertical ? [0, 1] : [1, 0])
    const yVector = applyVector(placement, vertical ? [-1, 0] : [0, 1])
    const font = this.fontName(ref(params[5])) ?? style.font
    const basePoint = textBasePoint(asString(params[0]) ?? '')
    const anchor = apply(placement, [0, textVerticalOffset(basePoint, height)])
    const primitive = {
      text,
      anchor,
      height: height * Math.hypot(...yVector),
      width: width * Math.hypot(...xVector),
      angleDeg: (Math.atan2(xVector[1], xVector[0]) * 180) / Math.PI,
      basePoint,
      style: { ...style, font },
      scale: averageScale(t)
    }
    const key = JSON.stringify([id, primitive.text, primitive.anchor, primitive.style.layer])
    if (this.textKeys.has(key)) return
    this.textKeys.add(key)
    this.drawing.texts.push(primitive)
  }

  private findNestedLayer(ids: number[], visited: Set<number>): string | undefined {
    for (const id of ids) {
      if (visited.has(id)) continue
      visited.add(id)
      const layer = this.layers.get(id)
      if (layer && !isDummyLayer(layer)) return layer
    }
    for (const id of ids) {
      const callout = this.get(id, 'DRAUGHTING_CALLOUT')
      if (!callout?.length) continue
      const layer = this.findNestedLayer(refs(callout[0]), visited)
      if (layer !== undefined) return layer
    }
    return undefined
  }

  private appendFillArea(id: number, fallback: SxfStyle, t: Affine, source: number) {
    const params = this.get(id, 'ANNOTATION_FILL_AREA')!
    const rings: Point[][] = []
    for (const boundary of refs(params[1])) {
      const merged = mergePieces(this.geometry(boundary))
      if (merged.length >= 3) rings.push(withoutDuplicateEnd(merged.map(p => apply(t, p))))
    }
    if (!rings.length) return
    const [outer, ...holes] = rings
    const scale = averageScale(t)
    let rendered = false
    for (const styleId of this.fillStyleEntities(source)) {
      const colour = this.get(styleId, 'FILL_AREA_STYLE_COLOUR')
      if (colour) {
        const colourId = ref(colour[1])
        const values = this.styleValues(colourId === undefined ? [] : [colourId])
        this.drawing.fills.push({
          outer,
          holes,
          style: this.styleFromValues(values, fallback.layer, fallback.visible),
          scale
        })
        rendered = true
        continue
      }
      const hatching = this.get(styleId, 'FILL_AREA_STYLE_HATCHING')
      if (hatching) {
        if (hatching.length < 6) continue
        const curveStyle = ref(hatching[1])
        const repeatId = ref(hatching[2])
        const startId = ref(hatching[3])
        if (curveStyle === undefined || repeatId === undefined || startId === undefined) continue
        const spacing = this.repeatSpacing(repeatId) * averageScale(t)
        const start = apply(t, this.point(startId))
        const local = asNumber(hatching[5]) ?? 0
        const direction = applyVector(t, [Math.cos(local), Math.sin(local)])
        const angle = (Math.atan2(direction[1], direction[0]) * 180) / Math.PI
        const style = this.renderStyle([curveStyle], fallback.layer, fallback.visible)
        for (const segment of clipHatchLines(outer, holes, start, spacing, angle)) {
          this.drawing.paths.push({ points: segment, closed: false, style, scale })
        }
        rendered = true
        continue
      }
      if (this.records.get(styleId)?.has('EXTERNALLY_DEFINED_HATCH_STYLE')) {
        this.drawing.warnOnce(
          'p21-external-hatch',
          'Externally defined hatch patterns have no embedded geometry'
        )
        rendered = true
      }
    }
    if (!rendered) {
      for (const ring of rings) {
        this.drawing.paths.push({ points: ring, closed: true, style: fallback, scale })
      }
    }
  }

  private appendDefinedSymbol(id: number, style: SxfStyle, t: Affine, source: number) {
    const params = this.get(id, 'DEFINED_SYMBOL')!
    const definitionId = ref(params[1])
    const targetId = ref(params[2])
    if (definitionId === undefined || targetId === undefined) return
    const symbolT = compose(t, this.symbolTargetTransform(targetId))
    const definition = this.records.get(definitionId)
    const scale = averageScale(symbolT)
    const terminator = definition?.get('PRE_DEFINED_TERMINATOR_SYMBOL')
    if (terminator) {
      const curveStyle = this.terminatorCurveStyle(source, style)
      if (curveStyle) {
        style = { ...style, lineType: curveStyle.lineType, lineWidth: curveStyle.lineWidth }
      }
      const name = (asString(terminator[0]) ?? '').trim().toLowerCase()
      const arrow: Point[] = [
        [-10, 3.5],
        [0, 0],
        [-10, -3.5]
      ]
      if (name === 'filled dot') {
        const dot = sampleCurve(ellipseCurve([0, 0], 5, 5, 0), 16)
        this.drawing.fills.push({ outer: dot.map(p => apply(symbolT, p)), holes: [], style, scale })
      } else if (name === 'filled arrow') {
        this.drawing.fills.push({ outer: arrow.map(p => apply(symbolT, p)), holes: [], style, scale })
      } else {
        this.drawing.paths.push({
          points: arrow.map(p => apply(symbolT, p)),
          closed: false,
          style,
          scale
        })
      }
      return
    }
    if (definition?.has('PRE_DEFINED_POINT_MARKER_SYMBOL')) {
      this.drawing.markers.push({ position: apply(symbolT, [0, 0]), style, scale })
      return
    }
    this.drawing.warnOnce(`p21-symbol-${definitionId}`, `Unsupported P21 defined symbol #${definitionId}`)
  }

  private terminatorCurveStyle(occurrence: number, fallback: SxfStyle) {
    const terminator = this.get(occurrence, 'TERMINATOR_SYMBOL')
    const curveId = terminator ? ref(terminator[0]) : undefined
    const styled = this.get(curveId, 'STYLED_ITEM')
    if (!styled) return undefined
    const [styleIds] = styledItemParts(styled)
    return styleIds.length ? this.renderStyle(styleIds, fallback.layer, fallback.visible) : undefined
  }

  private fillStyleEntities(occurrence: number) {
    const styled = this.get(occurrence, 'STYLED_ITEM')
    if (!styled) return []
    const out: number[] = []
    for (const assignmentId of styledItemParts(styled)[0]) {
      const assignment = this.get(assignmentId, 'PRESENTATION_STYLE_ASSIGNMENT')
      if (!assignment?.length) continue
      for (const fillStyleId of refs(assignment[0])) {
        const fillStyle = this.get(fillStyleId, 'FILL_AREA_STYLE')
        if (fillStyle && fillStyle.length >= 2) out.push(...refs(fillStyle[1]))
      }
    }
    return out
  }

  private renderStyle(styleIds: number[], layer: string, visible: boolean): SxfStyle {
    return this.styleFromValues(this.styleValues(styleIds), layer, visible)
  }

  private styleFromValues(values: StyleValues, layer: string, visible: boolean): SxfStyle {
    const lineType = values.lineType ?? 'continuous'
    return {
      layer,
      color: values.color ?? [0, 0, 0],
      lineType,
      lineTypePattern: this.userPatterns.get(lineType),
      lineWidth: values.lineWidth ?? 0.25,
      font: values.font,
      visible
    }
  }

  /** User-defined curve fonts (CURVE_STYLE_FONT) by name → dash pattern. */
  private readonly userPatterns = new Map<string, number[]>()

  private styleValues(ids: number[]): StyleValues {
    const key = ids.join(',')
    let values = this.styleCache.get(key)
    if (!values) {
      values = {}
      const visited = new Set<number>()
      for (const id of ids) this.visitStyle(id, values, visited)
      this.styleCache.set(key, values)
    }
    return values
  }

  private visitStyle(id: number, values: StyleValues, visited: Set<number>) {
    if (visited.has(id)) return
    visited.add(id)
    const records = this.records.get(id)
    if (!records) return

    const colour = records.get('DRAUGHTING_PRE_DEFINED_COLOUR')
    if (colour?.length) {
      values.color = predefinedColorByName(asString(colour[0]) ?? '') ?? [0, 0, 0]
    }
    const rgb = records.get('COLOUR_RGB')
    if (rgb && rgb.length >= 4) {
      const channel = (v: StepValue) =>
        Math.max(0, Math.min(255, Math.round((asNumber(v) ?? 0) * 255)))
      values.color = [channel(rgb[1]), channel(rgb[2]), channel(rgb[3])]
      // AP202 uses 0.75/0.5/0.25 for the extra SXF colours (SFC: 192/128/64).
      const name = (asString(rgb[0]) ?? '').replace(/^\$\$SXF_/i, '')
      const predefined = predefinedColorByName(name)
      if (predefined && predefined.every((c, i) => Math.abs(c - values.color![i]) <= 1)) {
        values.color = predefined
      }
    }
    const lineType = records.get('DRAUGHTING_PRE_DEFINED_CURVE_FONT')
    if (lineType?.length) values.lineType = normalizeSxfName(asString(lineType[0]) ?? '')
    const custom = records.get('CURVE_STYLE_FONT')
    if (custom?.length) {
      const name = (asString(custom[0]) ?? '').replace(/^\$\$SXF_/i, '')
      values.lineType = name
      if (!this.userPatterns.has(name)) this.userPatterns.set(name, this.curveFontPattern(custom))
    }
    const measure = records.get('LENGTH_MEASURE_WITH_UNIT')
    if (measure?.length) {
      const n = firstNumber(measure[0])
      if (n !== undefined && n > 0) values.lineWidth = n
    }
    const font = records.get('EXTERNALLY_DEFINED_TEXT_FONT')
    if (font?.length) {
      const name = firstString(font[0])
      if (name) values.font = name
    }
    for (const name of STYLE_CONTAINERS) {
      const params = records.get(name)
      if (params) for (const child of refs(params)) this.visitStyle(child, values, visited)
    }
  }

  /** CURVE_STYLE_FONT(name, (CURVE_STYLE_FONT_PATTERN(visible, invisible), …)). */
  private curveFontPattern(params: StepValue[]) {
    const pattern: number[] = []
    for (const id of refs(params[1])) {
      const segment = this.get(id, 'CURVE_STYLE_FONT_PATTERN')
      if (!segment) continue
      pattern.push(Math.abs(asNumber(segment[0]) ?? 0), -Math.abs(asNumber(segment[1]) ?? 0))
    }
    return pattern
  }

  private fontName(id: number | undefined) {
    if (id === undefined) return undefined
    const values: StyleValues = {}
    this.visitStyle(id, values, new Set())
    return values.font
  }

  private geometry(id: number): Geometry[] {
    const cached = this.geometryCache.get(id)
    if (cached) return cached
    this.geometryCache.set(id, [])
    const records = this.records.get(id)
    let geometry: Geometry[] = []
    if (!records) return geometry

    const polyline = records.get('POLYLINE')
    if (polyline && polyline.length >= 2) {
      const points = refs(polyline[1]).map(p => this.point(p))
      const closed = points.length > 2 && near(points[0], points[points.length - 1])
      geometry = [{ points: withoutDuplicateEnd(points), closed }]
    }
    for (const kind of ['CIRCLE', 'ELLIPSE']) {
      const params = records.get(kind)
      if (!params || params.length < 3) continue
      const axisId = ref(params[1])
      if (axisId === undefined) continue
      const axis = this.axisTransform(axisId)
      const rx = asNumber(params[2]) ?? 0
      const ry = kind === 'CIRCLE' ? rx : (asNumber(params[3]) ?? 0)
      const curve = ellipseCurve(apply(axis, [0, 0]), rx, ry, (Math.atan2(axis[1], axis[0]) * 180) / Math.PI)
      this.curveCache.set(id, curve)
      geometry = [{ points: sampleCurve(curve, this.segments), closed: true }]
    }
    const trimmed = records.get('TRIMMED_CURVE')
    if (trimmed) geometry = this.trimmedCurve(trimmed, id)

    const bezier = records.get('BEZIER_CURVE')
    if (bezier && bezier.length >= 6 && asNumber(bezier[1]) === 3) {
      const controls = refs(bezier[2]).map(p => this.point(p))
      const points = sampleSpline(controls, this.segments)
      if (points) {
        const closed = enumValue(bezier[4]) === 'T'
        geometry = [{ points: closed ? withoutDuplicateEnd(points) : points, closed }]
      }
    }

    const composite = records.get('COMPOSITE_CURVE')
    if (composite && composite.length >= 2) {
      const pieces: Geometry[] = []
      for (const segmentId of refs(composite[1])) {
        const segment = this.get(segmentId, 'COMPOSITE_CURVE_SEGMENT')
        if (!segment || segment.length < 3) continue
        const curveId = ref(segment[2])
        if (curveId === undefined) continue
        let segmentGeometry = this.geometry(curveId)
        if (enumValue(segment[1]) === 'F') {
          segmentGeometry = [...segmentGeometry]
            .reverse()
            .map(g => ({ points: [...g.points].reverse(), closed: g.closed }))
        }
        pieces.push(...segmentGeometry)
      }
      const merged = mergePieces(pieces)
      if (merged.length) {
        const closed = merged.length > 2 && near(merged[0], merged[merged.length - 1])
        geometry = [{ points: withoutDuplicateEnd(merged), closed }]
      }
    }
    this.geometryCache.set(id, geometry)
    return geometry
  }

  private trimmedCurve(params: StepValue[], id: number): Geometry[] {
    if (params.length < 6) return []
    const basis = this.records.get(ref(params[1]) ?? -1)
    if (!basis) return []
    const agrees = enumValue(params[4]) !== 'F'

    if (basis.has('LINE')) {
      const start = refs(params[2])[0]
      const end = refs(params[3])[0]
      if (start === undefined || end === undefined) return []
      const points = [this.point(start), this.point(end)]
      if (!agrees) points.reverse()
      return [{ points, closed: false }]
    }

    for (const kind of ['CIRCLE', 'ELLIPSE']) {
      const conic = basis.get(kind)
      if (!conic || conic.length < 3) continue
      const axisId = ref(conic[1])
      const start = firstNumber(params[2])
      const end = firstNumber(params[3])
      if (axisId === undefined || start === undefined || end === undefined) return []
      const axis = this.axisTransform(axisId)
      const center = apply(axis, [0, 0])
      const rotation = Math.atan2(axis[1], axis[0])
      const rx = asNumber(conic[2]) ?? 0
      const ry = kind === 'CIRCLE' ? rx : (asNumber(conic[3]) ?? 0)
      const direction = agrees ? 0 : 1
      // Circle trims are angles from the placement axis; ellipse trims are
      // parameters of the rotated ellipse (both in radians).
      const startDeg = (start * 180) / Math.PI
      const endDeg = (end * 180) / Math.PI
      const sweep = arcSweepDeg(startDeg, endDeg, direction)
      const curve: SxfCurve = {
        ...ellipseCurve(center, rx, ry, (rotation * 180) / Math.PI),
        start: (startDeg * Math.PI) / 180,
        end: ((startDeg + sweep) * Math.PI) / 180,
        closed: false
      }
      this.curveCache.set(id, curve)
      return [{ points: sampleCurve(curve, this.segments), closed: false }]
    }
    return []
  }

  private point(id: number): Point {
    const params = this.get(id, 'CARTESIAN_POINT')
    const values = asNumberList(params?.[1])
    return values && values.length >= 2 ? [values[0], values[1]] : [0, 0]
  }

  private direction(id: number | undefined): Point {
    const params = this.get(id, 'DIRECTION')
    const values = asNumberList(params?.[1])
    if (!values || values.length < 2) return [1, 0]
    const length = Math.hypot(values[0], values[1])
    return length <= 1e-15 ? [1, 0] : [values[0] / length, values[1] / length]
  }

  private axisTransform(id: number): Affine {
    const params = this.get(id, 'AXIS2_PLACEMENT_2D')
    if (!params) return IDENTITY
    const originId = ref(params[1])
    const origin = originId === undefined ? ([0, 0] as Point) : this.point(originId)
    const [dx, dy] = this.direction(ref(params[2]))
    return [dx, dy, -dy, dx, origin[0], origin[1]]
  }

  private symbolTargetTransform(id: number): Affine {
    const params = this.get(id, 'SYMBOL_TARGET')
    if (!params) return IDENTITY
    const axisId = ref(params[1])
    const axis = axisId === undefined ? IDENTITY : this.axisTransform(axisId)
    const rx = asNumber(params[2]) ?? 1
    const ry = asNumber(params[3]) ?? rx
    return compose(axis, [rx, 0, 0, ry, 0, 0])
  }

  private repeatSpacing(id: number) {
    const repeat = this.get(id, 'ONE_DIRECTION_REPEAT_FACTOR')
    const vector = this.get(ref(repeat?.[1]), 'VECTOR')
    return vector && vector.length >= 3 ? Math.abs(asNumber(vector[2]) ?? 0) : 0
  }
}

function withoutDuplicateEnd(points: Point[]) {
  return points.length > 2 && near(points[0], points[points.length - 1])
    ? points.slice(0, -1)
    : points
}

function mergePieces(pieces: Geometry[]): Point[] {
  const out: Point[] = []
  for (const { points } of pieces) {
    if (!points.length) continue
    if (!out.length) out.push(...points)
    else if (near(out[out.length - 1], points[0])) out.push(...points.slice(1))
    else if (near(out[out.length - 1], points[points.length - 1])) {
      out.push(...points.slice(0, -1).reverse())
    } else out.push(...points)
  }
  return out
}

function inverseAffine(t: Affine): Affine {
  const [a, b, c, d, e, f] = t
  const det = a * d - b * c
  if (Math.abs(det) <= 1e-15) return IDENTITY
  const ia = d / det
  const ib = -b / det
  const ic = -c / det
  const id = a / det
  return [ia, ib, ic, id, -(ia * e + ic * f), -(ib * e + id * f)]
}

/** Box alignment name (e.g. `bottom left`, `centreline centre`) → base point 1–9. */
function textBasePoint(name: string) {
  const n = name.toLowerCase()
  const horizontal = n.includes('left') ? 1 : n.includes('right') ? 3 : 2
  const vertical = /middleline|centreline/.test(n) ? 2 : /topline|capline/.test(n) ? 3 : 1
  return (vertical - 1) * 3 + horizontal
}

/**
 * The AP202 baseline origin differs from the SXF box anchor; this offset is
 * the convention of ezsxf's paired SFC/P21 corpus.
 */
function textVerticalOffset(basePoint: number, height: number) {
  const vertical = Math.min(2, Math.max(0, Math.floor((basePoint - 1) / 3)))
  return [-0.5, 0.5, 1][vertical] * height
}

/** Parses P21 text into drawing primitives. */
export function readP21Drawing(text: string, segments = 64) {
  return new P21DrawingBuilder(readP21Records(text), segments).build()
}
