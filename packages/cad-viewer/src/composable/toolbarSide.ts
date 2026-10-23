/** Canvas edge a toolbar is anchored to. */
export type MlToolbarSide = 'left' | 'right'

/** Viewport rectangle (a subset of `DOMRect`). */
export interface MlRect {
  left: number
  top: number
  right: number
  bottom: number
}

/** Gap kept between a toolbar and the palette before treating them as overlapping. */
const OVERLAP_MARGIN = 4

/** Inset of both toolbars from the canvas edge (matches their own CSS / options). */
export const ML_TOOLBAR_EDGE_OFFSET = 12

const intersects = (a: MlRect, b: MlRect) =>
  a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom

/**
 * Picks the canvas edge for a toolbar that normally sits on the right so it
 * does not end up under the tool palette.
 *
 * The toolbar keeps its size and vertical position on either edge, so both
 * candidate bands are derived from its current rectangle. It moves to the left
 * only when the palette covers the right band and leaves the left band free;
 * when both bands are covered (e.g. a full-width palette docked to the top)
 * moving would not help, so it stays on the right.
 *
 * @param container - Canvas area the toolbar is positioned in.
 * @param toolbar - Current toolbar rectangle (either edge).
 * @param obstacle - Palette rectangle, or `null` when the palette is closed.
 * @param edgeOffset - Toolbar inset from the canvas edge.
 * @returns The edge the toolbar should be anchored to.
 */
export function resolveToolbarSide(
  container: MlRect,
  toolbar: MlRect,
  obstacle: MlRect | null,
  edgeOffset: number = ML_TOOLBAR_EDGE_OFFSET
): MlToolbarSide {
  if (!obstacle) return 'right'
  const width = toolbar.right - toolbar.left
  const top = toolbar.top - OVERLAP_MARGIN
  const bottom = toolbar.bottom + OVERLAP_MARGIN
  const rightBand = {
    left: container.right - edgeOffset - width - OVERLAP_MARGIN,
    right: container.right - edgeOffset + OVERLAP_MARGIN,
    top,
    bottom
  }
  const leftBand = {
    left: container.left + edgeOffset - OVERLAP_MARGIN,
    right: container.left + edgeOffset + width + OVERLAP_MARGIN,
    top,
    bottom
  }
  return intersects(rightBand, obstacle) && !intersects(leftBand, obstacle)
    ? 'left'
    : 'right'
}
