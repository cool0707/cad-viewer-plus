import {
  AcGiMTextAttachmentPoint,
  AcGiMTextFlowDirection
} from '@mlightcad/data-model'
import type {
  MTextData,
  MTextObject,
  TextStyle
} from '@mlightcad/mtext-renderer'
import * as THREE from 'three'

/**
 * How a text is written vertically (縦書き).
 *
 * - `atFont`: the font name starts with `@` (Windows vertical font such as
 *   `@ＭＳ ゴシック`, used by Jw_cad 縦字 and AutoCAD). The text is laid out
 *   like horizontal text along its rotation, but full-width characters are
 *   turned 90° counter-clockwise, so a rotation of 270° reads top to bottom.
 *   Half-width characters stay on the baseline (they appear sideways).
 * - `style`: the text style has the AutoCAD "vertical" flag (group 70 bit 4).
 *   Every character is stacked upright along the rotation (270° by default),
 *   centred on the line through the insertion point. Like AutoCAD, this only
 *   applies to TEXT / ATTRIB, not MTEXT.
 */
export type AcTrVerticalTextMode = 'atFont' | 'style'

/** Text style flag (DXF group 70) bit for vertical text. */
const VERTICAL_STYLE_FLAG = 4

/**
 * Distance from the baseline to the centre of the em box, in em. Matches the
 * bundled BIZ UD fonts (descender 246 / 2048 em).
 */
const EM_CENTER_ABOVE_BASELINE = 0.5 - 246 / 2048

/** Em per DXF text height for the bundled BIZ UD fonts ("A" is 1617 / 2048 em). */
const FALLBACK_EM_PER_HEIGHT = 2048 / 1617

/** Characters drawn sideways (as in horizontal text) inside a vertical line. */
const SIDEWAYS = new Set(
  'ー―‐－—–～〜…‥＝＿：；（）「」『』【】〔〕［］｛｝〈〉《》＜＞≪≫｟｠〘〙〚〛｢｣()[]{}<>-~=_'
)

/** Punctuation that moves to the upper right of the cell in vertical text. */
const UPPER_RIGHT = new Set('、。，．')

/** Small kana that move slightly up and right in vertical text. */
const SMALL_KANA = new Set('ぁぃぅぇぉっゃゅょゎゕゖァィゥェォッャュョヮヵヶ')

/**
 * Whether a character is full-width (a double-byte character in Shift_JIS
 * terms). These are the characters a Windows `@` font turns upright.
 */
function isWide(ch: string) {
  const cp = ch.codePointAt(0) ?? 0
  return (
    (cp >= 0x1100 && cp <= 0x115f) ||
    (cp >= 0x2e80 && cp <= 0xa4cf && cp !== 0x303f) ||
    (cp >= 0xac00 && cp <= 0xd7a3) ||
    (cp >= 0xf900 && cp <= 0xfaff) ||
    (cp >= 0xfe30 && cp <= 0xfe4f) ||
    (cp >= 0xff01 && cp <= 0xff60) ||
    (cp >= 0xffe0 && cp <= 0xffe6) ||
    (cp >= 0x20000 && cp <= 0x3fffd) ||
    // Symbols that Japanese fonts draw full-width.
    (cp >= 0x2190 && cp <= 0x22ff) ||
    (cp >= 0x2460 && cp <= 0x27bf) ||
    (cp >= 0x2160 && cp <= 0x217f) ||
    [
      0xa7, 0xa8, 0xb0, 0xb1, 0xb4, 0xb6, 0xd7, 0xf7, 0x2010, 0x2015, 0x2016,
      0x2018, 0x2019, 0x201c, 0x201d, 0x2020, 0x2021, 0x2025, 0x2026, 0x2030,
      0x2032, 0x2033, 0x203b, 0x2103, 0x2116, 0x2121
    ].includes(cp)
  )
}

function isAtFont(font: string | undefined) {
  return typeof font === 'string' && font.trim().startsWith('@')
}

function stripAt(font: string | undefined) {
  return isAtFont(font) ? font!.trim().slice(1) : font
}

/**
 * Returns how the text is written vertically, or `undefined` for horizontal
 * text.
 *
 * @param text - Renderer input; TEXT / ATTRIB pass `BOTTOM_TO_TOP` as the
 *   drawing direction, which MTEXT never uses.
 * @param style - Resolved text style.
 */
export function acTrVerticalTextMode(
  text: { drawingDirection?: number },
  style: Pick<TextStyle, 'font' | 'extendedFont' | 'standardFlag'>
): AcTrVerticalTextMode | undefined {
  if (isAtFont(style.font) || isAtFont(style.extendedFont)) return 'atFont'
  if (
    ((style.standardFlag ?? 0) & VERTICAL_STYLE_FLAG) !== 0 &&
    text.drawingDirection === AcGiMTextFlowDirection.BOTTOM_TO_TOP
  ) {
    return 'style'
  }
  return undefined
}

/** Skips an MTEXT formatting code up to its `;`. Returns the index of `;`. */
function codeEnd(text: string, from: number) {
  const end = text.indexOf(';', from)
  return end === -1 ? text.length - 1 : end
}

/**
 * Splits TEXT / MTEXT contents into plain lines: formatting codes are
 * dropped, `\P` breaks lines, `%%d` / `%%p` / `%%c` / `\U+XXXX` are decoded
 * and stacks become `a/b`.
 */
export function acTrVerticalTextLines(contents: string): string[] {
  const lines: string[] = []
  let line = ''
  for (let i = 0; i < contents.length; i++) {
    const ch = contents[i]
    if (ch === '{' || ch === '}' || ch === '\r') continue
    if (ch === '\n') {
      lines.push(line)
      line = ''
      continue
    }
    if (ch === '%' && contents[i + 1] === '%' && i + 2 < contents.length) {
      const code = contents[i + 2]
      const digits = /^\d{3}/.exec(contents.slice(i + 2))
      if (digits) {
        line += String.fromCharCode(Number(digits[0]))
        i += 4
      } else {
        const symbols: Record<string, string> = {
          c: 'Ø',
          d: '°',
          p: '±',
          '%': '%'
        }
        const symbol = symbols[code.toLowerCase()]
        if (symbol !== undefined) line += symbol
        else if (!/[uok]/i.test(code)) line += `%%${code}`
        i += 2
      }
      continue
    }
    if (ch !== '\\' || i + 1 >= contents.length) {
      line += ch
      continue
    }
    const code = contents[++i]
    if (code === 'P' || code === 'X') {
      lines.push(line)
      line = ''
    } else if (code === '~') {
      line += ' '
    } else if (code === '\\' || code === '{' || code === '}') {
      line += code
    } else if (
      code === 'U' &&
      /^\+[0-9a-fA-F]{4}/.test(contents.slice(i + 1, i + 6))
    ) {
      line += String.fromCharCode(parseInt(contents.slice(i + 2, i + 6), 16))
      i += 5
    } else if (code === 'S') {
      const end = codeEnd(contents, i + 1)
      line += contents.slice(i + 1, end).replace(/[\^#]/, '/')
      i = end
    } else if (/[fFHWTQCcAap]/.test(code)) {
      i = codeEnd(contents, i + 1)
    } else if (!/[LlOoKkN]/.test(code)) {
      line += code
    }
  }
  lines.push(line)
  return lines
}

/** Escapes plain text so the mtext-renderer draws it literally. */
function escapeMText(text: string) {
  return text.replace(/[\\{}]/g, c => `\\${c}`).replace(/%%/g, '%%%%%%')
}

/** One character or run of characters rendered on its own. */
interface Piece {
  /** Upright pieces are turned to stand along the vertical line. */
  upright: boolean
  /** Full-width upright character (used to measure the em). */
  wide: boolean
  /** Offset inside the cell, in em (right, up as seen upright). */
  offset: [number, number]
  line: number
  data: MTextData
}

/** A gap that is not rendered (spaces). Width in em. */
interface Gap {
  line: number
  em: number
}

/**
 * Renders TEXT / MTEXT vertically with the regular horizontal mtext-renderer:
 * each character (or run of sideways characters) is rendered on its own at
 * the origin, then the pieces are moved into a vertical line.
 *
 * Use {@link pieces} to render, then {@link compose} with the results (in the
 * same order).
 */
export class AcTrVerticalTextLayout {
  /** Renderer inputs, all at the origin. */
  readonly pieces: { data: MTextData; style: TextStyle }[]
  private readonly items: (Piece | Gap)[] = []
  private readonly lineCount: number
  private readonly style: TextStyle

  constructor(
    private readonly mode: AcTrVerticalTextMode,
    private readonly text: MTextData,
    style: TextStyle
  ) {
    this.style = {
      ...style,
      font: stripAt(style.font) ?? '',
      bigFont: stripAt(style.bigFont) ?? '',
      extendedFont: stripAt(style.extendedFont),
      standardFlag: (style.standardFlag ?? 0) & ~VERTICAL_STYLE_FLAG
    }
    const lines = acTrVerticalTextLines(text.text ?? '')
    this.lineCount = lines.length
    lines.forEach((line, index) => this.split(line, index))
    this.pieces = this.items
      .filter((item): item is Piece => 'data' in item)
      .map(piece => ({ data: piece.data, style: this.style }))
  }

  /** Width factor along the line for @ fonts, across it for vertical styles. */
  private get widthFactor() {
    return this.text.widthFactor || this.style.widthFactor || 1
  }

  private pieceData(
    text: string,
    upright: boolean,
    widthFactor: number
  ): MTextData {
    return {
      text: escapeMText(text),
      height: this.text.height,
      width: Infinity,
      widthFactor,
      position: { x: 0, y: 0, z: 0 },
      rotation: 0,
      drawingDirection: AcGiMTextFlowDirection.BOTTOM_TO_TOP,
      attachmentPoint: upright
        ? AcGiMTextAttachmentPoint.BaselineCenter
        : AcGiMTextAttachmentPoint.BaselineLeft
    } as unknown as MTextData
  }

  private split(line: string, index: number) {
    let run = ''
    const flush = () => {
      if (!run) return
      this.items.push({
        upright: false,
        wide: false,
        offset: [0, 0],
        line: index,
        data: this.pieceData(run, false, this.widthFactor)
      })
      run = ''
    }
    for (const ch of line) {
      if (ch === ' ' || ch === '\t' || ch === '　') {
        flush()
        this.items.push({ line: index, em: ch === '　' ? 1 : 0.5 })
        continue
      }
      const wide = isWide(ch)
      const upright = SIDEWAYS.has(ch) ? false : this.mode === 'style' || wide
      if (!upright) {
        run += ch
        // Vertical styles keep each sideways character in its own cell.
        if (this.mode === 'style') flush()
        continue
      }
      flush()
      const offset: [number, number] = UPPER_RIGHT.has(ch)
        ? [0.55, 0.6]
        : SMALL_KANA.has(ch)
          ? [0.1, 0.1]
          : [0, 0]
      this.items.push({
        upright: true,
        wide,
        offset,
        line: index,
        // @ fonts scale the line direction, i.e. the height of upright glyphs.
        data: this.pieceData(
          ch,
          true,
          this.mode === 'atFont' ? 1 : this.widthFactor
        )
      })
    }
    flush()
  }

  /**
   * Places rendered pieces into one object.
   *
   * @param rendered - Results of rendering {@link pieces}, in order.
   * @returns Object whose children are the placed pieces, with a world-space
   *   `box` and merged layout data.
   */
  compose(rendered: MTextObject[]): MTextObject {
    const matrices = this.layout(rendered.map(object => object.box))
    const root = new THREE.Group() as unknown as MTextObject
    root.box = new THREE.Box3()
    rendered.forEach((object, i) => {
      object.applyMatrix4(matrices[i])
      object.updateMatrixWorld(true)
      if (!object.box.isEmpty()) {
        root.box.union(object.box.clone().applyMatrix4(matrices[i]))
      }
      root.add(object)
    })
    root.createLayoutData = () => ({
      lines: [],
      chars: rendered.flatMap(object => object.createLayoutData?.().chars ?? [])
    })
    return root
  }

  /**
   * Computes the placement of every piece from its rendered (unplaced) box.
   *
   * Works in a frame where `u` runs along the line (the text rotation) and
   * `v` is perpendicular to it (the "up" of horizontal text). Lines follow
   * each other in -v, so for a 270° rotation columns go right to left.
   */
  layout(boxes: THREE.Box3[]): THREE.Matrix4[] {
    const pieces = this.items.filter((item): item is Piece => 'data' in item)
    const wf = this.widthFactor
    const width = (box: THREE.Box3) =>
      box.isEmpty() ? 0 : box.max.x - box.min.x

    let em = 0
    pieces.forEach((piece, i) => {
      if (piece.wide) {
        em = Math.max(
          em,
          width(boxes[i]) / Math.abs(piece.data.widthFactor || 1)
        )
      }
    })
    if (!(em > 0)) em = this.text.height * FALLBACK_EM_PER_HEIGHT
    // Length of one em along the line.
    const step = this.mode === 'atFont' ? em * Math.abs(wf) : em
    const center = this.mode === 'atFont' ? EM_CENTER_ABOVE_BASELINE * em : 0
    const pitch = (5 / 3) * this.text.height * (this.text.lineSpaceFactor || 1)

    // Pen position of each item along its line.
    const lengths = new Array<number>(this.lineCount).fill(0)
    const starts: number[] = []
    const advances: number[] = []
    let p = 0
    for (const item of this.items) {
      let advance: number
      if (!('data' in item)) advance = item.em * step
      else if (item.upright) advance = step
      else advance = width(boxes[p]) || item.data.text.length * step * 0.5
      if ('data' in item) {
        starts.push(lengths[item.line])
        advances.push(advance)
        p++
      }
      lengths[item.line] += advance
    }
    const length = Math.max(0, ...lengths)

    const attachment = (this.text.attachmentPoint ??
      AcGiMTextAttachmentPoint.TopLeft) as number
    const column = (attachment - 1) % 3 // 0 left, 1 center, 2 right
    const vMax = center + em / 2
    const vMin = center - em / 2 - (this.lineCount - 1) * pitch
    const hu = (column / 2) * length
    const hv =
      attachment >= AcGiMTextAttachmentPoint.BaselineLeft
        ? 0
        : attachment <= AcGiMTextAttachmentPoint.TopRight
          ? vMax
          : attachment <= AcGiMTextAttachmentPoint.MiddleRight
            ? (vMin + vMax) / 2
            : vMin

    const direction = this.text.directionVector
    const angle =
      direction && (direction.x !== 0 || direction.y !== 0)
        ? Math.atan2(direction.y, direction.x)
        : this.text.rotation || 0
    const position = this.text.position
    const placement = new THREE.Matrix4()
      .makeTranslation(position.x, position.y, position.z ?? 0)
      .multiply(new THREE.Matrix4().makeRotationZ(angle))
      .multiply(new THREE.Matrix4().makeTranslation(-hu, -hv, 0))

    return pieces.map((piece, i) => {
      const lineShift = (column / 2) * (length - lengths[piece.line])
      const u = lineShift + starts[i]
      const v = center - piece.line * pitch
      const local = new THREE.Matrix4()
      if (piece.upright) {
        local
          .makeTranslation(u + advances[i] / 2, v, 0)
          .multiply(new THREE.Matrix4().makeRotationZ(Math.PI / 2))
          .multiply(
            new THREE.Matrix4().makeScale(
              1,
              this.mode === 'atFont' ? Math.abs(wf) : 1,
              1
            )
          )
          .multiply(
            new THREE.Matrix4().makeTranslation(
              piece.offset[0] * em,
              (piece.offset[1] - EM_CENTER_ABOVE_BASELINE) * em,
              0
            )
          )
      } else {
        local.makeTranslation(u, v - EM_CENTER_ABOVE_BASELINE * em, 0)
      }
      return placement.clone().multiply(local)
    })
  }
}
