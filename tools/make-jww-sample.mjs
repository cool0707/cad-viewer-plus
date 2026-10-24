/**
 * Generates resources/cad-data/samples/jww-sample.jww with the ezjww writer.
 *
 * A small A3 floor plan: layer group 0 "平面図" at 1/100 (grid lines, walls,
 * a door swing, room names, a dimension, a block) and layer group 1 "図枠" at
 * 1/1 (sheet border and title). Run: node tools/make-jww-sample.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(
  resolve(root, 'packages/cad-jww-converter/package.json')
)
const ez = require('ezjww')
ez.initSync(readFileSync(require.resolve('ezjww/wasm/ezjww_wasm_bg.wasm')))

const doc = ez.newJwwDocument()
const options = doc.options
options.paper_size = 3 // A3
options.memo = 'cad-viewer-plus JWW sample'
options.write_layer_group = 0

const plan = options.layer_groups[0]
plan.name = '平面図'
plan.scale = 100
plan.layers[0].name = '通り芯'
plan.layers[1].name = '壁'
plan.layers[2].name = '建具'
plan.layers[3].name = '文字'
plan.layers[4].name = '寸法'
const frame = options.layer_groups[1]
frame.name = '図枠'
frame.scale = 1
frame.state = 2
frame.layers[0].name = '枠'

const base = (group, layer, penColor, penStyle = 1) => ({
  group: 0,
  pen_style: penStyle,
  pen_color: penColor,
  pen_width: 0,
  layer,
  layer_group: group,
  flag: 0
})

const line = (b, x1, y1, x2, y2) => ({
  type: 'LINE',
  base: b,
  start_x: x1,
  start_y: y1,
  end_x: x2,
  end_y: y2
})

const rect = (b, x1, y1, x2, y2) => [
  line(b, x1, y1, x2, y1),
  line(b, x2, y1, x2, y2),
  line(b, x2, y2, x1, y2),
  line(b, x1, y2, x1, y1)
]

// Width in character cells: half-width characters take half a cell.
const cells = content =>
  [...content].reduce((sum, ch) => sum + (/[ -~｡-ﾟ]/.test(ch) ? 0.5 : 1), 0)

const text = (b, x, y, size, content, font = 'ＭＳ ゴシック') => ({
  type: 'TEXT',
  base: b,
  start_x: x,
  start_y: y,
  // Jw_cad stores the end of the baseline; a full-width cell is `size` wide.
  end_x: x + size * cells(content),
  end_y: y,
  text_type: 0,
  size_x: size,
  size_y: size,
  spacing: 0,
  angle: 0,
  font_name: font,
  content
})

// Jw_cad 縦字: an @ font, and the string runs downwards from the start point.
const verticalText = (b, x, y, size, content, font = '@ＭＳ ゴシック') => ({
  ...text(b, x, y, size, content, font),
  end_x: x,
  end_y: y - size * cells(content)
})

// Paper millimetres (the plan is 1/100: 1 mm on paper = 100 mm).
const W = 100 // 10 m
const H = 70 // 7 m
const x0 = -W / 2 - 30
const y0 = -H / 2 + 10

const entities = []
// Grid lines (one-dot chain line, pen 1).
for (const x of [x0, x0 + W / 2, x0 + W]) {
  entities.push(line(base(0, 0, 1, 5), x, y0 - 10, x, y0 + H + 10))
}
for (const y of [y0, y0 + H]) {
  entities.push(line(base(0, 0, 1, 5), x0 - 10, y, x0 + W + 10, y))
}
// Walls (pen 2) with a partition.
entities.push(...rect(base(0, 1, 2), x0, y0, x0 + W, y0 + H))
entities.push(line(base(0, 1, 2), x0 + W / 2, y0, x0 + W / 2, y0 + H))
// Door swing (pen 3): leaf + quarter arc.
entities.push(line(base(0, 2, 3), x0 + W / 2, y0 + 20, x0 + W / 2 + 9, y0 + 20))
entities.push({
  type: 'ARC',
  is_full_circle: false,
  base: base(0, 2, 3),
  center_x: x0 + W / 2,
  center_y: y0 + 20,
  radius: 9,
  start_angle: 0,
  arc_angle: Math.PI / 2,
  tilt_angle: 0,
  flatness: 1
})
// Round table (circle) and an oval rug (ellipse).
entities.push({
  type: 'CIRCLE',
  is_full_circle: true,
  base: base(0, 2, 3),
  center_x: x0 + W / 4,
  center_y: y0 + H / 2,
  radius: 6,
  start_angle: 0,
  arc_angle: Math.PI * 2,
  tilt_angle: 0,
  flatness: 1
})
entities.push({
  type: 'CIRCLE',
  is_full_circle: true,
  base: base(0, 2, 6),
  center_x: x0 + (W * 3) / 4,
  center_y: y0 + H / 2,
  radius: 14,
  start_angle: 0,
  arc_angle: Math.PI * 2,
  tilt_angle: Math.PI / 6,
  flatness: 0.5
})
// Column (filled solid, pen 4).
entities.push({
  type: 'SOLID',
  base: base(0, 1, 4),
  // Jw_cad's outline order is point1 → point4 → point2 → point3.
  point1_x: x0 - 2,
  point1_y: y0 - 2,
  point4_x: x0 + 2,
  point4_y: y0 - 2,
  point2_x: x0 + 2,
  point2_y: y0 + 2,
  point3_x: x0 - 2,
  point3_y: y0 + 2
})
// Room names.
entities.push(text(base(0, 3, 2), x0 + 15, y0 + H - 15, 4, '居間・食堂'))
entities.push(text(base(0, 3, 2), x0 + W / 2 + 15, y0 + H - 15, 4, '寝室'))
entities.push(
  verticalText(base(0, 3, 2), x0 + W - 10, y0 + H - 25, 4, '収納（押入れ）')
)
// Dimension (10,000 between the outer grid lines).
const dimY = y0 - 18
const dimBase = base(0, 4, 1)
const point = (x, y) => ({
  base: dimBase,
  x,
  y,
  is_temporary: false,
  code: 0,
  angle: 0,
  scale: 0
})
entities.push({
  type: 'DIMENSION',
  base: dimBase,
  line: {
    base: dimBase,
    start_x: x0,
    start_y: dimY,
    end_x: x0 + W,
    end_y: dimY
  },
  text: {
    base: dimBase,
    start_x: x0 + W / 2 - 3.75,
    start_y: dimY + 1,
    end_x: x0 + W / 2 + 3.75,
    end_y: dimY + 1,
    text_type: 0,
    size_x: 2.5,
    size_y: 2.5,
    spacing: 0,
    angle: 0,
    font_name: 'ＭＳ ゴシック',
    content: '10,000'
  },
  sxf_mode: 1,
  // Extension lines from the grid lines down to the dimension line.
  aux_lines: [
    {
      base: dimBase,
      start_x: x0,
      start_y: y0 - 12,
      end_x: x0,
      end_y: dimY - 2
    },
    {
      base: dimBase,
      start_x: x0 + W,
      start_y: y0 - 12,
      end_x: x0 + W,
      end_y: dimY - 2
    }
  ],
  aux_points: [
    point(x0, dimY),
    point(x0 + W, dimY),
    point(x0, y0 - 12),
    point(x0 + W, y0 - 12)
  ]
})
// North arrow block, placed once.
const arrowBase = base(0, 3, 2)
doc.block_defs = [
  {
    number: 1,
    is_referenced: true,
    name: '方位記号',
    base: arrowBase,
    entities: [
      {
        type: 'CIRCLE',
        is_full_circle: true,
        base: arrowBase,
        center_x: 0,
        center_y: 0,
        radius: 5,
        start_angle: 0,
        arc_angle: Math.PI * 2,
        tilt_angle: 0,
        flatness: 1
      },
      line(arrowBase, 0, -5, 0, 7),
      line(arrowBase, -2, 3, 0, 7),
      line(arrowBase, 2, 3, 0, 7),
      text(arrowBase, -1.25, 8, 2.5, 'N', 'ＭＳ 明朝')
    ]
  }
]
entities.push({
  type: 'BLOCK',
  base: arrowBase,
  ref_x: x0 + W + 30,
  ref_y: y0 + H,
  scale_x: 1,
  scale_y: 1,
  rotation: 0,
  def_number: 1
})
// Sheet border and title block in the 1/1 group (paper millimetres).
entities.push(...rect(base(1, 0, 2), -200, -138.5, 200, 138.5))
entities.push(...rect(base(1, 0, 2), 90, -138.5, 200, -108.5))
entities.push(text(base(1, 0, 2), 95, -120, 5, 'サンプル平面図', 'ＭＳ 明朝'))
entities.push(text(base(1, 0, 2), 95, -132, 3.5, 'S=1/100  A3'))

doc.entities = entities
const bytes = ez.toJwwBytes(doc)
const out = resolve(root, 'resources/cad-data/samples/jww-sample.jww')
writeFileSync(out, bytes)
console.log(`wrote ${out} (${bytes.length} bytes)`)
