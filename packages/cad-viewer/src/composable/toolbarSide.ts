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
 * Whether a toolbar is under (or within a few px of) the palette.
 *
 * @param toolbar - Toolbar rectangle.
 * @param obstacle - Palette rectangle.
 */
export function isToolbarCovered(toolbar: MlRect, obstacle: MlRect): boolean {
  return intersects(
    {
      left: toolbar.left - OVERLAP_MARGIN,
      top: toolbar.top - OVERLAP_MARGIN,
      right: toolbar.right + OVERLAP_MARGIN,
      bottom: toolbar.bottom + OVERLAP_MARGIN
    },
    obstacle
  )
}

/**
 * Picks the canvas edge for a toolbar that normally sits on `preferred` so it
 * does not end up under the tool palette.
 *
 * The toolbar keeps its size and vertical position on either edge, so both
 * candidate bands are derived from its current rectangle. It moves to the
 * other edge only when the palette covers the preferred band and leaves the
 * other band free; when both bands are covered (e.g. a full-width palette
 * docked to the top) moving would not help, so it stays on `preferred`.
 *
 * @param container - Canvas area the toolbar is positioned in.
 * @param toolbar - Current toolbar rectangle (either edge).
 * @param obstacle - Palette rectangle, or `null` when the palette is closed.
 * @param edgeOffset - Toolbar inset from the canvas edge.
 * @param preferred - Edge used whenever the palette is not in the way.
 * @returns The edge the toolbar should be anchored to.
 */
export function resolveToolbarSide(
  container: MlRect,
  toolbar: MlRect,
  obstacle: MlRect | null,
  edgeOffset: number = ML_TOOLBAR_EDGE_OFFSET,
  preferred: MlToolbarSide = 'right'
): MlToolbarSide {
  if (!obstacle) return preferred
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
  const [preferredBand, otherBand] =
    preferred === 'right' ? [rightBand, leftBand] : [leftBand, rightBand]
  if (intersects(preferredBand, obstacle) && !intersects(otherBand, obstacle)) {
    return preferred === 'right' ? 'left' : 'right'
  }
  return preferred
}
