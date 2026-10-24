import {
  escapeMTextLiteral,
  horizontalTextStyle,
  VerticalTextLayout,
  type VerticalTextMode,
  verticalTextMode
} from '@mlightcad/cad-vertical-text'
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

/** See {@link VerticalTextMode}. */
export type AcTrVerticalTextMode = VerticalTextMode

/**
 * Returns how the text is written vertically (縦書き), or `undefined` for
 * horizontal text. See {@link verticalTextMode}.
 */
export function acTrVerticalTextMode(
  text: { drawingDirection?: number },
  style: Pick<TextStyle, 'font' | 'extendedFont' | 'standardFlag'>
): AcTrVerticalTextMode | undefined {
  return verticalTextMode(text, style)
}

/**
 * Renders TEXT / MTEXT vertically with the regular horizontal mtext-renderer:
 * each character (or run of sideways characters) is rendered on its own at
 * the origin, then the pieces are moved into a vertical line by
 * {@link VerticalTextLayout}.
 *
 * Use {@link pieces} to render, then {@link compose} with the results (in the
 * same order).
 */
export class AcTrVerticalTextLayout {
  /** Renderer inputs, all at the origin. */
  readonly pieces: { data: MTextData; style: TextStyle }[]
  private readonly layout: VerticalTextLayout

  constructor(mode: AcTrVerticalTextMode, text: MTextData, style: TextStyle) {
    this.layout = new VerticalTextLayout(mode, text, style.widthFactor)
    const pieceStyle = horizontalTextStyle(style)
    this.pieces = this.layout.pieces.map(piece => ({
      data: {
        text: escapeMTextLiteral(piece.text),
        height: text.height,
        width: Infinity,
        widthFactor: piece.widthFactor,
        position: { x: 0, y: 0, z: 0 },
        rotation: 0,
        drawingDirection: AcGiMTextFlowDirection.BOTTOM_TO_TOP,
        attachmentPoint:
          piece.anchor === 'baselineCenter'
            ? AcGiMTextAttachmentPoint.BaselineCenter
            : AcGiMTextAttachmentPoint.BaselineLeft
      } as unknown as MTextData,
      style: pieceStyle
    }))
  }

  /**
   * Places rendered pieces into one object.
   *
   * @param rendered - Results of rendering {@link pieces}, in order.
   * @returns Object whose children are the placed pieces, with a world-space
   *   `box` and merged layout data.
   */
  compose(rendered: MTextObject[]): MTextObject {
    const matrices = this.matrices(rendered.map(object => object.box))
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
   * Placement of every piece from its rendered (unplaced) box, whose width is
   * the piece's advance.
   */
  matrices(boxes: THREE.Box3[]): THREE.Matrix4[] {
    const { matrices } = this.layout.place(
      boxes.map(box => (box.isEmpty() ? 0 : box.max.x - box.min.x))
    )
    return matrices.map(([a, b, c, d, e, f]) =>
      new THREE.Matrix4().set(a, c, 0, e, b, d, 0, f, 0, 0, 1, 0, 0, 0, 0, 1)
    )
  }
}
