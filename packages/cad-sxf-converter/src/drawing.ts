/**
 * Format-neutral drawing primitives for SXF (SFC / P21) and the geometry
 * helpers that produce them.
 *
 * The structure follows ezsxf's drawing backends (MIT,
 * https://github.com/monozukuri-ai/ezsxf, `src/ezsxf/_drawing*.py`), with
 * circles, arcs and ellipses kept as exact curves where the placement allows.
 */

export type Point = [number, number]
export type Rgb = [number, number, number]
/** Affine transform `[a, b, c, d, e, f]`: x' = a·x + c·y + e, y' = b·x + d·y + f. */
export type Affine = [number, number, number, number, number, number]

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0]

export interface SxfStyle {
  layer: string
  color: Rgb
  /** Normalized SXF line type name (`continuous`, `chain`, … or a user name). */
  lineType: string
  /** Dash pattern in paper millimetres for user-defined line types. */
  lineTypePattern?: number[]
  /** Line width in paper millimetres. */
  lineWidth: number
  font?: string
  /** False when the layer (or a parent placement's layer) is hidden. */
  visible: boolean
}

/**
 * Exact circle / ellipse curve: `center + u·cos(t) + v·sin(t)` for `t` from
 * `start` to `end` (radians; `end < start` runs clockwise). `u` and `v` are
 * conjugate semi-diameters.
 */
export interface SxfCurve {
  center: Point
  u: Point
  v: Point
  start: number
  end: number
  closed: boolean
}

interface Primitive {
  style: SxfStyle
  /** Paper millimetres per drawing unit at this primitive (placement scale). */
  scale: number
}

export interface SxfPath extends Primitive {
  points: Point[]
  closed: boolean
  curve?: SxfCurve
}

export interface SxfFill extends Primitive {
  outer: Point[]
  holes: Point[][]
}

export interface SxfText extends Primitive {
  text: string
  anchor: Point
  /** Text box height and width (whole string) in paper units. */
  height: number
  width: number
  angleDeg: number
  /** 1–9: left/centre/right × bottom/middle/top. */
  basePoint: number
}

export interface SxfMarker extends Primitive {
  position: Point
}

export interface SxfSheet {
  name: string
  width: number
  height: number
}

export class SxfDrawing {
  paths: SxfPath[] = []
  fills: SxfFill[] = []
  texts: SxfText[] = []
  markers: SxfMarker[] = []
  warnings: string[] = []
  sheet?: SxfSheet
  private warned = new Set<string>()

  warnOnce(key: string, message: string) {
    if (this.warned.has(key)) return
    this.warned.add(key)
    this.warnings.push(message)
  }
}

export function apply(t: Affine, p: Point): Point {
  return [t[0] * p[0] + t[2] * p[1] + t[4], t[1] * p[0] + t[3] * p[1] + t[5]]
}

export function applyVector(t: Affine, v: Point): Point {
  return [t[0] * v[0] + t[2] * v[1], t[1] * v[0] + t[3] * v[1]]
}

export function compose(parent: Affine, local: Affine): Affine {
  const [a, b, c, d, e, f] = parent
  const [la, lb, lc, ld, le, lf] = local
  return [
    a * la + c * lb,
    b * la + d * lb,
    a * lc + c * ld,
    b * lc + d * ld,
    a * le + c * lf + e,
    b * le + d * lf + f
  ]
}

export function averageScale(t: Affine) {
  return (Math.hypot(t[0], t[1]) + Math.hypot(t[2], t[3])) / 2
}

/** Rotation by `angleDeg` with X/Y ratios, then translation. */
export function placement(
  position: Point,
  angleDeg: number,
  ratioX: number,
  ratioY: number
): Affine {
  const a = (angleDeg * Math.PI) / 180
  return [
    Math.cos(a) * ratioX,
    Math.sin(a) * ratioX,
    -Math.sin(a) * ratioY,
    Math.cos(a) * ratioY,
    position[0],
    position[1]
  ]
}

const deg = (r: number) => (r * 180) / Math.PI
const rad = (d: number) => (d * Math.PI) / 180

/** Signed sweep of an SXF arc in degrees (positive = counter-clockwise, never 0). */
export function arcSweepDeg(
  startDeg: number,
  endDeg: number,
  direction: number
) {
  const mod = (v: number) => ((v % 360) + 360) % 360
  let sweep = direction === 1 ? -mod(startDeg - endDeg) : mod(endDeg - startDeg)
  if (Math.abs(sweep) <= 1e-12) sweep = direction === 1 ? -360 : 360
  return sweep
}

export function sampleCurve(curve: SxfCurve, segments: number): Point[] {
  const sweep = curve.end - curve.start
  const count = curve.closed
    ? segments
    : Math.max(2, Math.ceil((segments * Math.abs(sweep)) / (2 * Math.PI)))
  const points: Point[] = []
  const limit = curve.closed ? count : count + 1
  for (let i = 0; i < limit; i++) {
    const t = curve.start + (sweep * i) / count
    points.push([
      curve.center[0] + curve.u[0] * Math.cos(t) + curve.v[0] * Math.sin(t),
      curve.center[1] + curve.u[1] * Math.cos(t) + curve.v[1] * Math.sin(t)
    ])
  }
  return points
}

export function transformCurve(t: Affine, curve: SxfCurve): SxfCurve {
  return {
    ...curve,
    center: apply(t, curve.center),
    u: applyVector(t, curve.u),
    v: applyVector(t, curve.v)
  }
}

export function circleCurve(center: Point, radius: number): SxfCurve {
  return {
    center,
    u: [radius, 0],
    v: [0, radius],
    start: 0,
    end: 2 * Math.PI,
    closed: true
  }
}

export function arcCurve(
  center: Point,
  radius: number,
  startDeg: number,
  endDeg: number,
  direction: number
): SxfCurve {
  const sweep = arcSweepDeg(startDeg, endDeg, direction)
  return {
    center,
    u: [radius, 0],
    v: [0, radius],
    start: rad(startDeg),
    end: rad(startDeg + sweep),
    closed: false
  }
}

export function ellipseCurve(
  center: Point,
  radiusX: number,
  radiusY: number,
  rotationDeg: number,
  arc?: { startDeg: number; endDeg: number; direction: number }
): SxfCurve {
  const r = rad(rotationDeg)
  const u: Point = [radiusX * Math.cos(r), radiusX * Math.sin(r)]
  const v: Point = [-radiusY * Math.sin(r), radiusY * Math.cos(r)]
  if (!arc) return { center, u, v, start: 0, end: 2 * Math.PI, closed: true }
  const sweep = arcSweepDeg(arc.startDeg, arc.endDeg, arc.direction)
  return {
    center,
    u,
    v,
    start: rad(arc.startDeg),
    end: rad(arc.startDeg + sweep),
    closed: false
  }
}

/**
 * Converts conjugate semi-diameters to principal axes: returns the major
 * axis vector, minor/major ratio and the parameter offset `φ` such that the
 * curve parameter `t` maps to principal parameter `t - φ`.
 */
export function principalAxes(curve: SxfCurve) {
  const [ux, uy] = curve.u
  const [vx, vy] = curve.v
  // Maximize |u·cos φ + v·sin φ|²: tan 2φ = 2 u·v / (|u|² − |v|²).
  const uv = ux * vx + uy * vy
  const uu = ux * ux + uy * uy
  const vv = vx * vx + vy * vy
  let phi = 0.5 * Math.atan2(2 * uv, uu - vv)
  const axisAt = (p: number): Point => [
    ux * Math.cos(p) + vx * Math.sin(p),
    uy * Math.cos(p) + vy * Math.sin(p)
  ]
  let major = axisAt(phi)
  let minor = axisAt(phi + Math.PI / 2)
  if (Math.hypot(...minor) > Math.hypot(...major)) {
    phi += Math.PI / 2
    ;[major, minor] = [minor, major]
  }
  const majorLength = Math.hypot(...major)
  const minorLength = Math.hypot(...minor)
  // Orientation: positive when v is counter-clockwise from u.
  const orientation = Math.sign(ux * vy - uy * vx) || 1
  return {
    major,
    ratio: majorLength > 0 ? minorLength / majorLength : 1,
    phi,
    orientation,
    majorLength,
    minorLength
  }
}

export function sampleSpline(
  controls: Point[],
  segments: number
): Point[] | undefined {
  if (controls.length < 4 || (controls.length - 1) % 3 !== 0) return undefined
  const perSegment = Math.max(4, Math.floor(segments / 4))
  const out: Point[] = []
  for (let o = 0; o + 3 < controls.length; o += 3) {
    const [p0, p1, p2, p3] = controls.slice(o, o + 4)
    for (let i = out.length ? 1 : 0; i <= perSegment; i++) {
      const t = i / perSegment
      const u = 1 - t
      out.push([
        u ** 3 * p0[0] +
          3 * u * u * t * p1[0] +
          3 * u * t * t * p2[0] +
          t ** 3 * p3[0],
        u ** 3 * p0[1] +
          3 * u * u * t * p1[1] +
          3 * u * t * t * p2[1] +
          t ** 3 * p3[1]
      ])
    }
  }
  return out
}

export function sampleClothoid(
  base: Point,
  parameter: number,
  direction: number,
  angleDeg: number,
  startLength: number,
  endLength: number,
  segments: number
): Point[] {
  const start = Math.min(startLength, endLength)
  const end = Math.max(startLength, endLength)
  const span = end - start
  const a = parameter > 0 ? parameter : 1
  const count = Math.min(
    Math.max(2, Math.ceil((segments * span) / a)),
    segments * 16
  )
  const warmup = Math.min(
    Math.max(1, Math.ceil((segments * start) / a)),
    segments * 16
  )
  const lengths =
    start <= 1e-12
      ? [0]
      : Array.from({ length: warmup + 1 }, (_, i) => (start * i) / warmup)
  if (span > 1e-12) {
    for (let i = 1; i <= count; i++) lengths.push(start + (span * i) / count)
  }
  const sign = direction === 1 ? -1 : 1
  let x = 0
  let y = 0
  let previous = 0
  const samples: [number, Point][] = [[0, [0, 0]]]
  for (const length of lengths.slice(1)) {
    const delta = length - previous
    const mid = previous + delta / 2
    const tangent = (sign * mid * mid) / (2 * a * a)
    x += Math.cos(tangent) * delta
    y += Math.sin(tangent) * delta
    samples.push([length, [x, y]])
    previous = length
  }
  const r = rad(angleDeg)
  const points = samples
    .filter(([length]) => length + 1e-12 >= start)
    .map(
      ([, p]): Point => [
        base[0] + p[0] * Math.cos(r) - p[1] * Math.sin(r),
        base[1] + p[0] * Math.sin(r) + p[1] * Math.cos(r)
      ]
    )
  if (startLength > endLength) points.reverse()
  return points
}

const dot = (a: Point, b: Point) => a[0] * b[0] + a[1] * b[1]

/** Parallel hatch lines clipped to a region with holes (even-odd). */
export function clipHatchLines(
  outer: Point[],
  holes: Point[][],
  start: Point,
  spacing: number,
  angleDeg: number,
  limit = 200_000
): [Point, Point][] {
  if (!(spacing > 0) || outer.length < 3) return []
  const r = rad(angleDeg)
  const direction: Point = [Math.cos(r), Math.sin(r)]
  const normal: Point = [-direction[1], direction[0]]
  const rings = [outer, ...holes].filter(ring => ring.length >= 3)
  let minimum = Infinity
  let maximum = -Infinity
  for (const ring of rings) {
    for (const p of ring) {
      const n = dot(p, normal)
      minimum = Math.min(minimum, n)
      maximum = Math.max(maximum, n)
    }
  }
  const base = dot(start, normal)
  const first = Math.floor((minimum - base) / spacing)
  const last = Math.min(Math.ceil((maximum - base) / spacing), first + limit)
  const out: [Point, Point][] = []
  for (let index = first; index <= last && out.length < limit; index++) {
    const offset = base + index * spacing
    const hits: number[] = []
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i++) {
        const p1 = ring[i]
        const p2 = ring[(i + 1) % ring.length]
        const n1 = dot(p1, normal)
        const n2 = dot(p2, normal)
        if ((n1 <= offset && offset < n2) || (n2 <= offset && offset < n1)) {
          const ratio = (offset - n1) / (n2 - n1)
          const a1 = dot(p1, direction)
          hits.push(a1 + ratio * (dot(p2, direction) - a1))
        }
      }
    }
    hits.sort((a, b) => a - b)
    const unique = hits.filter(
      (v, i) => i === 0 || Math.abs(v - hits[i - 1]) > 1e-9
    )
    for (let i = 0; i + 1 < unique.length; i += 2) {
      const at = (s: number): Point => [
        direction[0] * s + normal[0] * offset,
        direction[1] * s + normal[1] * offset
      ]
      out.push([at(unique[i]), at(unique[i + 1])])
    }
  }
  return out
}

export function distance(a: Point, b: Point) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

export function near(a: Point, b: Point) {
  const scale = Math.max(
    1,
    Math.abs(a[0]),
    Math.abs(a[1]),
    Math.abs(b[0]),
    Math.abs(b[1])
  )
  return distance(a, b) <= scale * 1e-9
}

export { deg, rad }
