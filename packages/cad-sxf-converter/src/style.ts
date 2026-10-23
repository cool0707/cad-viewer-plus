import type { Rgb } from './drawing'

/**
 * SXF Ver.3.1 predefined colours, line types and widths (common predefined
 * elements specification; values as in ezsxf `_drawing_style.py`).
 */
export const SXF_PREDEFINED_COLORS: Record<number, Rgb> = {
  1: [0, 0, 0],
  2: [255, 0, 0],
  3: [0, 255, 0],
  4: [0, 0, 255],
  5: [255, 255, 0],
  6: [255, 0, 255],
  7: [0, 255, 255],
  8: [255, 255, 255],
  9: [192, 0, 128],
  10: [192, 128, 64],
  11: [255, 128, 0],
  12: [128, 192, 128],
  13: [0, 128, 255],
  14: [128, 64, 255],
  15: [192, 192, 192],
  16: [128, 128, 128]
}

const COLOR_NAMES = [
  'black',
  'red',
  'green',
  'blue',
  'yellow',
  'magenta',
  'cyan',
  'white',
  'deeppink',
  'brown',
  'orange',
  'lightgreen',
  'lightblue',
  'lavender',
  'lightgray',
  'darkgray'
]

export const SXF_PREDEFINED_LINE_TYPES = [
  'continuous',
  'dashed',
  'dashed spaced',
  'long dashed dotted',
  'long dashed double-dotted',
  'long dashed triplicate-dotted',
  'dotted',
  'chain',
  'chain double dash',
  'dashed dotted',
  'double-dashed dotted',
  'dashed double-dotted',
  'double-dashed double-dotted',
  'dashed triplicate-dotted',
  'double-dashed triplicate-dotted'
]

export const SXF_PREDEFINED_WIDTHS = [
  0.13, 0.18, 0.25, 0.35, 0.5, 0.7, 1.0, 1.4, 2.0
]

/** Reference pitches in paper millimetres; negative values are gaps. */
export const SXF_LINE_TYPE_PATTERNS: Record<string, number[]> = {
  continuous: [],
  dashed: [6, -1.5],
  'dashed spaced': [6, -6],
  'long dashed dotted': [12, -1.5, 0.25, -1.5],
  'long dashed double-dotted': [12, -1.5, 0.25, -1.5, 0.25, -1.5],
  'long dashed triplicate-dotted': [
    12, -1.5, 0.25, -1.5, 0.25, -1.5, 0.25, -1.5
  ],
  dotted: [0.25, -1.5],
  chain: [12, -1.5, 3.5, -1.5],
  'chain double dash': [12, -1.5, 3.5, -1.5, 3.5, -1.5],
  'dashed dotted': [6, -1.5, 0.25, -1.5],
  'double-dashed dotted': [6, -1.5, 6, -1.5, 0.25, -1.5],
  'dashed double-dotted': [6, -1.5, 0.25, -1.5, 0.25, -1.5],
  'double-dashed double-dotted': [6, -1.5, 6, -1.5, 0.25, -1.5, 0.25, -1.5],
  'dashed triplicate-dotted': [6, -1.5, 0.25, -1.5, 0.25, -1.5, 0.25, -1.5],
  'double-dashed triplicate-dotted': [
    6, -1.5, 6, -1.5, 0.25, -1.5, 0.25, -1.5, 0.25, -1.5
  ]
}

export function normalizeSxfName(name: string) {
  return name.trim().split(/\s+/).join(' ').toLowerCase()
}

export function predefinedColorCode(name: string) {
  const index = COLOR_NAMES.indexOf(normalizeSxfName(name).replace(/ /g, ''))
  return index < 0 ? undefined : index + 1
}

export function predefinedColorByName(name: string): Rgb | undefined {
  const code = predefinedColorCode(name)
  return code ? SXF_PREDEFINED_COLORS[code] : undefined
}

export function predefinedLineTypeCode(name: string) {
  const index = SXF_PREDEFINED_LINE_TYPES.indexOf(normalizeSxfName(name))
  return index < 0 ? undefined : index + 1
}

export function predefinedWidthCode(width: number) {
  const index = SXF_PREDEFINED_WIDTHS.findIndex(
    w => Math.abs(w - width) <= 1e-9
  )
  return index < 0 ? undefined : index + 1
}

/** User-defined pitch list (dash, gap, dash, …) as a signed pattern. */
export function pitchPattern(pitch: number[]) {
  const values = pitch.map(Math.abs)
  const even = values.length % 2 === 1 ? [...values, ...values] : values
  return even.map((v, i) => (i % 2 === 0 ? v : -v))
}
