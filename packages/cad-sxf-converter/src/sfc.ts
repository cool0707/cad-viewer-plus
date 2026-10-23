/**
 * SFC (SXF feature comment file) reader.
 *
 * Feature layouts, code numbering and the definition order rules follow the
 * SXF Ver.3.1 feature specification as implemented by ezsxf (MIT,
 * https://github.com/monozukuri-ai/ezsxf: `src/features.rs`,
 * `src/document.rs`, `src/ezsxf/_drawing_builder.py`, `_drawing_hatches.py`,
 * `_drawing_annotations.py`).
 */
import {
  type Affine,
  apply,
  applyVector,
  arcCurve,
  averageScale,
  circleCurve,
  clipHatchLines,
  compose,
  distance,
  ellipseCurve,
  IDENTITY,
  near,
  placement,
  type Point,
  type Rgb,
  sampleClothoid,
  sampleCurve,
  sampleSpline,
  type SxfCurve,
  SxfDrawing,
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
import {
  pitchPattern,
  predefinedColorByName,
  predefinedColorCode,
  predefinedLineTypeCode,
  predefinedWidthCode,
  SXF_PREDEFINED_COLORS,
  SXF_PREDEFINED_LINE_TYPES,
  SXF_PREDEFINED_WIDTHS
} from './style'

/** One feature record: `#id = <keyword>_feature(params)`. */
export interface SfcFeature {
  id: number
  /** Keyword without `_feature`, with aliases folded (e.g. `composite_curve`). */
  kind: string
  params: StepValue[]
}

const KIND_ALIASES: Record<string, string> = {
  composite_curve_org: 'composite_curve',
  symbol_externally_defined: 'externally_defined_symbol',
  fill_area_style_tiles_hatching: 'fill_area_style_tiles'
}

/** Feature kinds that are drawing components (ezsxf `requires_pre_sheet_order`). */
const COMPONENT_KINDS = new Set([
  'sfig_locate',
  'externally_defined_symbol',
  'linear_dim',
  'curve_dim',
  'angular_dim',
  'radius_dim',
  'diameter_dim',
  'label',
  'balloon',
  'externally_defined_hatch',
  'fill_area_style_colour',
  'fill_area_style_hatching',
  'fill_area_style_tiles',
  'point_marker',
  'line',
  'polyline',
  'circle',
  'arc',
  'ellipse',
  'ellipse_arc',
  'text_string',
  'spline',
  'clothoid'
])

const HATCH_KINDS = new Set([
  'externally_defined_hatch',
  'fill_area_style_colour',
  'fill_area_style_hatching',
  'fill_area_style_tiles'
])

/** Extracts the feature records from SFC text. */
export function readSfcFeatures(text: string): SfcFeature[] {
  const features: SfcFeature[] = []
  const block = /\/\*SXF(?:3\.1|3)?\s([\s\S]*?)SXF(?:3\.1|3)?\*\//g
  for (let match = block.exec(text); match; match = block.exec(text)) {
    const reader = new StepReader(match[1], true)
    try {
      const entity = reader.entity()
      const record = entity.records[0]
      if (!record) continue
      const keyword = record.keyword.toLowerCase().replace(/_feature$/, '')
      features.push({
        id: entity.id,
        kind: KIND_ALIASES[keyword] ?? keyword,
        params: record.params
      })
    } catch {
      // A damaged feature block is skipped, as ezsxf does in lenient mode.
    }
  }
  return features
}

interface Definition {
  name: string
  kind: number
  components: number[]
}

/** Resolved SFC structure (ezsxf `SfcModel`). */
export interface SfcModel {
  features: Map<number, SfcFeature>
  layers: Map<number, SfcFeature>
  colors: Map<number, SfcFeature>
  lineTypes: Map<number, SfcFeature>
  widths: Map<number, SfcFeature>
  fonts: Map<number, SfcFeature>
  definitions: Map<number, Definition>
  definitionsByName: Map<string, number>
  /** Composite curve feature id → component ids. */
  composites: Map<number, number[]>
  /** Hatch id → [outer composite id, inner composite ids]. */
  hatches: Map<number, { outer: number; inner: number[] }>
  sheet?: SfcFeature
  sheetComponents: number[]
  warnings: string[]
}

export function buildSfcModel(list: SfcFeature[]): SfcModel {
  const model: SfcModel = {
    features: new Map(list.map(f => [f.id, f])),
    layers: new Map(),
    colors: new Map(),
    lineTypes: new Map(),
    widths: new Map(),
    fonts: new Map(),
    definitions: new Map(),
    definitionsByName: new Map(),
    composites: new Map(),
    hatches: new Map(),
    sheetComponents: [],
    warnings: []
  }

  // Code tables (document.rs `build_sfc_code_tables`): file order.
  let nextLayer = 1
  let nextUserLineType = 17
  let nextUserColor = 17
  let nextUserWidth = 11
  let nextFont = 1
  for (const f of list) {
    switch (f.kind) {
      case 'layer':
        model.layers.set(nextLayer++, f)
        break
      case 'pre_defined_font': {
        const code = predefinedLineTypeCode(asString(f.params[0]) ?? '')
        if (code) model.lineTypes.set(code, f)
        break
      }
      case 'user_defined_font':
        model.lineTypes.set(nextUserLineType++, f)
        break
      case 'pre_defined_colour': {
        const code = predefinedColorCode(asString(f.params[0]) ?? '')
        if (code) model.colors.set(code, f)
        break
      }
      case 'user_defined_colour':
        model.colors.set(nextUserColor++, f)
        break
      case 'width': {
        const width = asNumber(f.params[0]) ?? 0
        model.widths.set(predefinedWidthCode(width) ?? nextUserWidth++, f)
        break
      }
      case 'text_font':
        model.fonts.set(nextFont++, f)
        break
    }
  }

  // Hierarchy (document.rs `build_sfc_model`): components precede the
  // definition, composite curve or drawing sheet that owns them.
  let buffer: number[] = []
  const compositeCodes: number[] = []
  let seenSheet = false
  for (const f of list) {
    if (seenSheet) continue
    if (f.kind === 'sfig_org') {
      const name = asString(f.params[0]) ?? ''
      if (model.definitionsByName.has(name)) {
        model.warnings.push(
          `Duplicate composite figure name "${name}" (#${f.id})`
        )
        buffer = []
        continue
      }
      model.definitions.set(f.id, {
        name,
        kind: asNumber(f.params[1]) ?? 0,
        components: buffer
      })
      model.definitionsByName.set(name, f.id)
      buffer = []
    } else if (f.kind === 'composite_curve') {
      model.composites.set(f.id, buffer)
      compositeCodes.push(f.id)
      buffer = []
    } else if (f.kind === 'drawing_sheet') {
      model.sheet = f
      model.sheetComponents = buffer
      buffer = []
      seenSheet = true
    } else if (COMPONENT_KINDS.has(f.kind)) {
      if (HATCH_KINDS.has(f.kind)) {
        const refs = hatchCompositeCodes(f)
        const outer = compositeCodes[refs.out - 1]
        const inner = refs.in.map(code => compositeCodes[code - 1])
        if (outer === undefined || inner.some(id => id === undefined)) {
          model.warnings.push(
            `Hatch #${f.id} references an undefined composite curve`
          )
          continue
        }
        model.hatches.set(f.id, { outer, inner })
      }
      buffer.push(f.id)
    }
  }
  if (!model.sheet && buffer.length > 0) {
    model.warnings.push('drawing_sheet_feature is missing')
    model.sheetComponents = buffer
  }
  return model
}

function hatchCompositeCodes(f: SfcFeature) {
  const p = f.params
  if (f.kind === 'fill_area_style_hatching') {
    const count = asNumber(p[1]) ?? 0
    const end = 2 + count
    return { out: asNumber(p[end]) ?? 0, in: asNumberList(p[end + 2]) ?? [] }
  }
  if (f.kind === 'fill_area_style_tiles') {
    return { out: asNumber(p[12]) ?? 0, in: asNumberList(p[14]) ?? [] }
  }
  // externally_defined_hatch: layer, name, out; colour: layer, color, out.
  return { out: asNumber(p[2]) ?? 0, in: asNumberList(p[4]) ?? [] }
}

/** Sheet size in millimetres: A0–A4 by code and orientation, or FREE (9). */
export function sfcSheetSize(
  type: number,
  orientation: number,
  x: number,
  y: number
) {
  const sizes: Record<number, [number, number]> = {
    0: [841, 1189],
    1: [594, 841],
    2: [420, 594],
    3: [297, 420],
    4: [210, 297]
  }
  const size = sizes[type]
  if (!size) return { width: x > 0 ? x : 297, height: y > 0 ? y : 210 }
  return orientation === 0
    ? { width: size[0], height: size[1] }
    : { width: size[1], height: size[0] }
}

interface RawStyle {
  layer?: number
  color?: number
  lineType?: number
  width?: number
  font?: number
}

const num = (f: SfcFeature, i: number) => asNumber(f.params[i]) ?? 0
const pt = (f: SfcFeature, i: number): Point => [num(f, i), num(f, i + 1)]
const lineStyle = (f: SfcFeature): RawStyle => ({
  layer: asNumber(f.params[0]),
  color: asNumber(f.params[1]),
  lineType: asNumber(f.params[2]),
  width: asNumber(f.params[3])
})

/** Text block of a dimension / label / balloon (features.rs `parse_feature_text`). */
interface FeatureText {
  present: boolean
  font: number
  text: string
  anchor: Point
  height: number
  width: number
  angleDeg: number
  basePoint: number
  direction: number
}

function featureText(f: SfcFeature, i: number): FeatureText {
  return {
    present: num(f, i) === 1,
    font: num(f, i + 1),
    text: asString(f.params[i + 2]) ?? '',
    anchor: pt(f, i + 3),
    height: num(f, i + 5),
    width: num(f, i + 6),
    angleDeg: num(f, i + 8),
    basePoint: num(f, i + 10) || 1,
    direction: num(f, i + 11) || 1
  }
}

interface Arrow {
  code: number
  direction: number
  position: Point
  scale: number
}

const arrowAt = (f: SfcFeature, i: number): Arrow => ({
  code: num(f, i),
  direction: num(f, i + 1),
  position: pt(f, i + 2),
  scale: num(f, i + 4)
})

const extensionAt = (f: SfcFeature, i: number) => ({
  present: num(f, i) === 1,
  start: pt(f, i + 3),
  end: pt(f, i + 5)
})

/** Flattens an SFC model into drawing primitives. */
export class SfcDrawingBuilder {
  readonly drawing = new SxfDrawing()

  constructor(
    private readonly model: SfcModel,
    private readonly segments = 64
  ) {}

  build() {
    const model = this.model
    this.drawing.warnings.push(...model.warnings)
    if (model.sheet) {
      const f = model.sheet
      this.drawing.sheet = {
        name: asString(f.params[0]) ?? '',
        ...sfcSheetSize(num(f, 1), num(f, 2), num(f, 3), num(f, 4))
      }
    }
    for (const id of model.sheetComponents) {
      this.render(id, IDENTITY, undefined, true, new Set())
    }
    return this.drawing
  }

  private render(
    id: number,
    t: Affine,
    layerOverride: number | undefined,
    parentVisible: boolean,
    active: Set<number>
  ) {
    const f = this.model.features.get(id)
    if (!f) return
    if (f.kind === 'sfig_locate') {
      this.renderPlacement(f, t, layerOverride, parentVisible, active)
      return
    }
    if (HATCH_KINDS.has(f.kind)) {
      this.renderHatch(f, t, layerOverride, parentVisible)
      return
    }
    const raw: RawStyle =
      f.kind === 'text_string'
        ? {
            layer: asNumber(f.params[0]),
            color: asNumber(f.params[1]),
            font: asNumber(f.params[2])
          }
        : f.kind === 'point_marker'
          ? { layer: asNumber(f.params[0]), color: asNumber(f.params[1]) }
          : f.kind === 'externally_defined_symbol'
            ? { layer: asNumber(f.params[0]), color: asNumber(f.params[2]) }
            : lineStyle(f)
    const style = this.resolve(raw, layerOverride, parentVisible)
    const scale = averageScale(t)

    const geometry = this.geometry(f)
    if (geometry) {
      for (const g of geometry)
        this.addPath(g.points, g.closed, style, t, g.curve)
      return
    }
    switch (f.kind) {
      case 'text_string':
        this.addText(
          {
            present: true,
            font: num(f, 2),
            text: asString(f.params[3]) ?? '',
            anchor: pt(f, 4),
            height: num(f, 6),
            width: num(f, 7),
            angleDeg: num(f, 9),
            basePoint: num(f, 11) || 1,
            direction: num(f, 12) || 1
          },
          style,
          t
        )
        break
      case 'point_marker':
        this.drawing.markers.push({
          position: apply(t, pt(f, 2)),
          style,
          scale
        })
        break
      case 'externally_defined_symbol':
        this.drawing.markers.push({
          position: apply(t, pt(f, 4)),
          style,
          scale
        })
        this.drawing.warnOnce(
          'external-symbol',
          'Externally defined symbols are shown as insertion points'
        )
        break
      case 'linear_dim':
      case 'curve_dim':
      case 'angular_dim':
      case 'radius_dim':
      case 'diameter_dim':
      case 'label':
      case 'balloon':
        this.renderAnnotation(f, t, style)
        break
      default:
        this.drawing.warnOnce(
          `unsupported-${f.kind}`,
          `SFC feature "${f.kind}" is not drawn`
        )
    }
  }

  /** Simple geometry of curve-like features in local coordinates. */
  private geometry(
    f: SfcFeature
  ): { points: Point[]; closed: boolean; curve?: SxfCurve }[] | undefined {
    switch (f.kind) {
      case 'line':
        return [{ points: [pt(f, 4), pt(f, 6)], closed: false }]
      case 'polyline': {
        let points = xyList(f, 5)
        const closed =
          points.length > 2 && near(points[0], points[points.length - 1])
        if (closed) points = points.slice(0, -1)
        return [{ points, closed }]
      }
      case 'circle':
        return [curveGeometry(circleCurve(pt(f, 4), num(f, 6)), this.segments)]
      case 'arc':
        return [
          curveGeometry(
            arcCurve(pt(f, 4), num(f, 6), num(f, 8), num(f, 9), num(f, 7)),
            this.segments
          )
        ]
      case 'ellipse':
        return [
          curveGeometry(
            ellipseCurve(pt(f, 4), num(f, 6), num(f, 7), num(f, 8)),
            this.segments
          )
        ]
      case 'ellipse_arc':
        return [
          curveGeometry(
            ellipseCurve(pt(f, 4), num(f, 6), num(f, 7), num(f, 9), {
              startDeg: num(f, 10),
              endDeg: num(f, 11),
              direction: num(f, 8)
            }),
            this.segments
          )
        ]
      case 'spline': {
        const controls = xyList(f, 6)
        let points = sampleSpline(controls, this.segments)
        if (!points) {
          this.drawing.warnOnce(
            'spline-control-layout',
            'Spline control-point count is not 3n+1; the control polygon was used'
          )
          points = controls
        }
        const closed = num(f, 4) === 0
        if (
          closed &&
          points.length > 1 &&
          near(points[0], points[points.length - 1])
        ) {
          points = points.slice(0, -1)
        }
        return [{ points, closed }]
      }
      case 'clothoid':
        return [
          {
            points: sampleClothoid(
              pt(f, 4),
              num(f, 6),
              num(f, 7),
              num(f, 8),
              num(f, 9),
              num(f, 10),
              this.segments
            ),
            closed: false
          }
        ]
    }
    return undefined
  }

  private addPath(
    points: Point[],
    closed: boolean,
    style: SxfStyle,
    t: Affine,
    curve?: SxfCurve
  ) {
    if (points.length < 2) return
    this.drawing.paths.push({
      points: points.map(p => apply(t, p)),
      closed,
      style,
      scale: averageScale(t),
      curve: curve ? transformCurve(t, curve) : undefined
    })
  }

  private addText(text: FeatureText, style: SxfStyle, t: Affine) {
    if (!text.text) return
    let angle = text.angleDeg
    if (text.direction === 2) angle += 90
    const r = (angle * Math.PI) / 180
    const direction = applyVector(t, [Math.cos(r), Math.sin(r)])
    const normal = applyVector(t, [-Math.sin(r), Math.cos(r)])
    this.drawing.texts.push({
      text: text.text,
      anchor: apply(t, text.anchor),
      height: Math.abs(text.height) * Math.hypot(...normal),
      width: Math.abs(text.width) * Math.hypot(...direction),
      angleDeg: (Math.atan2(direction[1], direction[0]) * 180) / Math.PI,
      basePoint: text.basePoint,
      style,
      scale: averageScale(t)
    })
  }

  private renderPlacement(
    f: SfcFeature,
    t: Affine,
    layerOverride: number | undefined,
    parentVisible: boolean,
    active: Set<number>
  ) {
    const name = asString(f.params[1]) ?? ''
    const definitionId = this.model.definitionsByName.get(name)
    const definition =
      definitionId === undefined
        ? undefined
        : this.model.definitions.get(definitionId)
    if (definitionId === undefined || !definition) {
      this.drawing.warnOnce(
        `placement-${f.id}`,
        `Composite figure "${name}" is not defined`
      )
      return
    }
    if (active.has(definitionId)) {
      this.drawing.warnOnce(
        `cycle-${definitionId}`,
        `Cyclic composite figure "${name}" was not expanded`
      )
      return
    }
    const rawLayer = asNumber(f.params[0])
    const visible = parentVisible && this.layerVisible(rawLayer)
    // Partial drawings (kind 1 mathematical, 2 geodetic) are complete views
    // whose elements keep their own layers; groups and parts (3, 4) put
    // their elements on the placement layer, as ezsxf does.
    const isPartialDrawing = definition.kind === 1 || definition.kind === 2
    const nextLayer =
      layerOverride ?? (rawLayer && !isPartialDrawing ? rawLayer : undefined)
    const local = placement(pt(f, 2), num(f, 4), num(f, 5) || 1, num(f, 6) || 1)
    const nextActive = new Set(active).add(definitionId)
    const placed = compose(t, local)
    for (const id of definition.components) {
      this.render(id, placed, nextLayer, visible, nextActive)
    }
  }

  private renderHatch(
    f: SfcFeature,
    t: Affine,
    layerOverride: number | undefined,
    parentVisible: boolean
  ) {
    const reference = this.model.hatches.get(f.id)
    if (!reference) return
    const hatchLayer = asNumber(f.params[0])
    const layer = layerOverride ?? (hatchLayer ? hatchLayer : undefined)

    const outerPaths = this.compositePaths(
      reference.outer,
      layer,
      parentVisible
    )
    const outer = this.joinRing(outerPaths.paths, f.id)
    if (outer.length === 0) return
    const holes: Point[][] = []
    const boundaries = [outerPaths]
    for (const id of reference.inner) {
      const inner = this.compositePaths(id, layer, parentVisible)
      const ring = this.joinRing(inner.paths, f.id)
      if (ring.length) holes.push(ring)
      boundaries.push(inner)
    }
    for (const boundary of boundaries) {
      if (!boundary.visible) continue
      for (const path of boundary.paths) {
        this.addPath(path.points, path.closed, path.style, t, path.curve)
      }
    }

    const style = this.resolve(
      {
        layer: hatchLayer,
        color:
          f.kind === 'fill_area_style_colour'
            ? asNumber(f.params[1])
            : undefined
      },
      layer,
      parentVisible
    )
    const scale = averageScale(t)
    const tOuter = outer.map(p => apply(t, p))
    const tHoles = holes.map(h => h.map(p => apply(t, p)))
    if (f.kind === 'fill_area_style_colour') {
      this.drawing.fills.push({ outer: tOuter, holes: tHoles, style, scale })
    } else if (f.kind === 'fill_area_style_hatching') {
      const count = num(f, 1)
      for (let i = 0; i < count; i++) {
        const values = asNumberList(f.params[2 + i])
        if (!values || values.length !== 7) continue
        const [color, lineType, width, sx, sy, spacing, angle] = values
        const patternStyle = this.resolve(
          { layer: hatchLayer, color, lineType, width },
          layer,
          parentVisible
        )
        const segments = clipHatchLines(outer, holes, [sx, sy], spacing, angle)
        if (segments.length >= 200_000) {
          this.drawing.warnOnce(
            'hatch-limit',
            'Hatch line generation was limited to 200000 segments'
          )
        }
        for (const segment of segments) {
          this.addPath(segment, false, patternStyle, t)
        }
      }
    } else if (f.kind === 'externally_defined_hatch') {
      this.drawing.warnOnce(
        'external-hatch',
        'Externally defined hatch patterns are shown by their visible boundaries'
      )
    } else {
      this.drawing.warnOnce(
        'tile-hatch',
        'Tile hatch patterns are shown by their visible boundaries'
      )
    }
  }

  private compositePaths(
    id: number,
    layer: number | undefined,
    parentVisible: boolean
  ) {
    const marker = this.model.features.get(id)
    const components = this.model.composites.get(id) ?? []
    const paths: {
      points: Point[]
      closed: boolean
      style: SxfStyle
      curve?: SxfCurve
    }[] = []
    if (!marker) return { paths, visible: false }
    const override: RawStyle = {
      color: asNumber(marker.params[0]),
      lineType: asNumber(marker.params[1]),
      width: asNumber(marker.params[2])
    }
    for (const componentId of components) {
      const component = this.model.features.get(componentId)
      if (!component) continue
      const geometry = this.geometry(component)
      if (!geometry) continue
      const raw = { ...lineStyle(component) }
      if (override.color !== undefined) raw.color = override.color
      if (override.lineType !== undefined) raw.lineType = override.lineType
      if (override.width !== undefined) raw.width = override.width
      const style = this.resolve(raw, layer, parentVisible)
      for (const g of geometry) paths.push({ ...g, style })
    }
    // composite_curve flag: 1 = visible boundary.
    return { paths, visible: num(marker, 3) === 1 }
  }

  private joinRing(
    paths: { points: Point[]; closed: boolean }[],
    hatchId: number
  ): Point[] {
    if (paths.length === 0) return []
    let points = [...paths[0].points]
    if (paths[0].closed) return points
    const scale = Math.max(
      1,
      ...paths.flatMap(p =>
        p.points.flatMap(q => [Math.abs(q[0]), Math.abs(q[1])])
      )
    )
    const tolerance = scale * 1e-7
    for (const path of paths.slice(1)) {
      const candidate = [...path.points]
      if (!candidate.length) continue
      if (distance(points[points.length - 1], candidate[0]) <= tolerance) {
        points = points.concat(candidate.slice(1))
      } else if (
        distance(points[points.length - 1], candidate[candidate.length - 1]) <=
        tolerance
      ) {
        points = points.concat(candidate.reverse().slice(1))
      } else {
        this.drawing.warnOnce(
          `hatch-gap-${hatchId}`,
          `Hatch #${hatchId} boundary is not connected`
        )
        points = points.concat(candidate)
      }
    }
    if (
      points.length > 2 &&
      distance(points[0], points[points.length - 1]) <= tolerance
    ) {
      points.pop()
    }
    return points
  }

  private renderAnnotation(f: SfcFeature, t: Affine, style: SxfStyle) {
    const kind = f.kind
    let textIndex = 0
    const arrows: { arrow: Arrow; vector: Point }[] = []
    const sub = (a: Point, b: Point): Point => [a[0] - b[0], a[1] - b[1]]

    if (
      kind === 'linear_dim' ||
      kind === 'radius_dim' ||
      kind === 'diameter_dim'
    ) {
      const start = pt(f, 4)
      const end = pt(f, 6)
      this.addPath([start, end], false, style, t)
      if (kind === 'linear_dim') {
        for (const index of [8, 15]) {
          const ext = extensionAt(f, index)
          if (ext.present) this.addPath([ext.start, ext.end], false, style, t)
        }
        arrows.push({ arrow: arrowAt(f, 22), vector: sub(end, start) })
        arrows.push({ arrow: arrowAt(f, 27), vector: sub(start, end) })
        textIndex = 32
      } else if (kind === 'radius_dim') {
        arrows.push({ arrow: arrowAt(f, 8), vector: sub(start, end) })
        textIndex = 13
      } else {
        arrows.push({ arrow: arrowAt(f, 8), vector: sub(end, start) })
        arrows.push({ arrow: arrowAt(f, 13), vector: sub(start, end) })
        textIndex = 18
      }
    } else if (kind === 'curve_dim' || kind === 'angular_dim') {
      const center = pt(f, 4)
      const curve = arcCurve(center, num(f, 6), num(f, 7), num(f, 8), 0)
      this.addPath(sampleCurve(curve, this.segments), false, style, t, curve)
      for (const index of [9, 16]) {
        const ext = extensionAt(f, index)
        if (ext.present) this.addPath([ext.start, ext.end], false, style, t)
      }
      for (const [index, sign] of [
        [23, 1],
        [28, -1]
      ]) {
        const arrow = arrowAt(f, index)
        const radial = sub(arrow.position, center)
        arrows.push({ arrow, vector: [-radial[1] * sign, radial[0] * sign] })
      }
      textIndex = 33
    } else {
      // label / balloon
      const vertices = xyList(f, 5)
      if (vertices.length >= 2) {
        this.addPath(vertices, false, style, t)
        const code = num(f, kind === 'label' ? 7 : 10)
        if (code !== 0) {
          arrows.push({
            arrow: {
              code,
              direction: 2,
              position: vertices[0],
              scale: num(f, kind === 'label' ? 8 : 11)
            },
            vector: sub(vertices[1], vertices[0])
          })
        }
      }
      if (kind === 'balloon') {
        const curve = circleCurve(pt(f, 7), num(f, 9))
        this.addPath(sampleCurve(curve, this.segments), true, style, t, curve)
      }
      textIndex = kind === 'label' ? 9 : 12
    }

    for (const { arrow, vector } of arrows)
      this.addArrow(arrow, vector, style, t)

    const text = featureText(f, textIndex)
    if (text.present) {
      const font = this.fontName(text.font)
      this.addText(text, { ...style, font }, t)
    }
  }

  /** Open arrowhead (two strokes), as ezsxf draws dimension arrows. */
  private addArrow(arrow: Arrow, vector: Point, style: SxfStyle, t: Affine) {
    if (arrow.direction === 0) return
    const length = Math.hypot(...vector)
    if (length <= 1e-12) return
    let unit: Point = [vector[0] / length, vector[1] / length]
    if (arrow.direction === 1) unit = [-unit[0], -unit[1]]
    const normal: Point = [-unit[1], unit[0]]
    const size = Math.max((arrow.scale || 1) * 10, style.lineWidth * 3)
    const tip = arrow.position
    const left: Point = [
      tip[0] - unit[0] * size + normal[0] * size * 0.35,
      tip[1] - unit[1] * size + normal[1] * size * 0.35
    ]
    const right: Point = [
      tip[0] - unit[0] * size - normal[0] * size * 0.35,
      tip[1] - unit[1] * size - normal[1] * size * 0.35
    ]
    this.addPath([left, tip, right], false, style, t)
  }

  private layerVisible(code: number | undefined) {
    const layer = code === undefined ? undefined : this.model.layers.get(code)
    return !layer || num(layer, 1) === 1
  }

  private fontName(code: number | undefined) {
    const f = code === undefined ? undefined : this.model.fonts.get(code)
    return f ? asString(f.params[0]) || undefined : undefined
  }

  private resolve(
    raw: RawStyle,
    layerOverride: number | undefined,
    parentVisible: boolean
  ): SxfStyle {
    const layerCode = layerOverride ?? raw.layer
    const layerFeature =
      layerCode === undefined ? undefined : this.model.layers.get(layerCode)
    let layer = '0'
    let layerVisible = true
    if (layerFeature) {
      layer = asString(layerFeature.params[0]) || '0'
      layerVisible = num(layerFeature, 1) === 1
    } else if (layerCode) {
      layer = `SXF_LAYER_${layerCode}`
    }
    return {
      layer,
      color: this.color(raw.color),
      ...this.lineType(raw.lineType),
      lineWidth: this.width(raw.width),
      font: this.fontName(raw.font),
      visible: parentVisible && layerVisible
    }
  }

  private color(code: number | undefined): Rgb {
    if (code !== undefined && SXF_PREDEFINED_COLORS[code])
      return SXF_PREDEFINED_COLORS[code]
    const f = code === undefined ? undefined : this.model.colors.get(code)
    if (!f) return [0, 0, 0]
    if (f.kind === 'user_defined_colour') {
      const c = (i: number) => Math.max(0, Math.min(255, num(f, i)))
      return [c(0), c(1), c(2)]
    }
    return predefinedColorByName(asString(f.params[0]) ?? '') ?? [0, 0, 0]
  }

  private lineType(code: number | undefined): {
    lineType: string
    lineTypePattern?: number[]
  } {
    if (
      code !== undefined &&
      code >= 1 &&
      code <= SXF_PREDEFINED_LINE_TYPES.length
    ) {
      return { lineType: SXF_PREDEFINED_LINE_TYPES[code - 1] }
    }
    const f = code === undefined ? undefined : this.model.lineTypes.get(code)
    if (!f) return { lineType: 'continuous' }
    const name = asString(f.params[0]) || 'continuous'
    if (f.kind === 'user_defined_font') {
      return {
        lineType: name,
        lineTypePattern: pitchPattern(asNumberList(f.params[2]) ?? [])
      }
    }
    return { lineType: name }
  }

  private width(code: number | undefined) {
    if (
      code !== undefined &&
      code >= 1 &&
      code <= SXF_PREDEFINED_WIDTHS.length
    ) {
      return SXF_PREDEFINED_WIDTHS[code - 1]
    }
    const f = code === undefined ? undefined : this.model.widths.get(code)
    const value = f ? num(f, 0) : 0.25
    return value > 0 ? value : 0.25
  }
}

function xyList(f: SfcFeature, index: number): Point[] {
  const xs = asNumberList(f.params[index]) ?? []
  const ys = asNumberList(f.params[index + 1]) ?? []
  const count = Math.min(xs.length, ys.length)
  return Array.from({ length: count }, (_, i): Point => [xs[i], ys[i]])
}

function curveGeometry(curve: SxfCurve, segments: number) {
  return { points: sampleCurve(curve, segments), closed: curve.closed, curve }
}

/** Parses SFC text into drawing primitives. */
export function readSfcDrawing(text: string, segments = 64) {
  return new SfcDrawingBuilder(
    buildSfcModel(readSfcFeatures(text)),
    segments
  ).build()
}
