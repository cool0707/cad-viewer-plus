import { resolveToolbarSide } from '../src/composable/toolbarSide'

/** Canvas 0..1000 x 0..600, toolbar 40 px wide hugging the right edge. */
const container = { left: 0, top: 0, right: 1000, bottom: 600 }
const toolbarOnRight = { left: 948, top: 150, right: 988, bottom: 450 }
const toolbarOnLeft = { left: 12, top: 150, right: 52, bottom: 450 }

describe('resolveToolbarSide', () => {
  test('stays on the right while the palette is closed', () => {
    expect(resolveToolbarSide(container, toolbarOnRight, null)).toBe('right')
  })

  test('moves left when the palette is docked to the right', () => {
    const palette = { left: 700, top: 0, right: 1000, bottom: 600 }
    expect(resolveToolbarSide(container, toolbarOnRight, palette)).toBe('left')
    // Same answer once moved, so it does not flip back and forth.
    expect(resolveToolbarSide(container, toolbarOnLeft, palette)).toBe('left')
  })

  test('returns right when the palette moves back to the left', () => {
    const palette = { left: 0, top: 0, right: 300, bottom: 600 }
    expect(resolveToolbarSide(container, toolbarOnLeft, palette)).toBe('right')
  })

  test('moves left when a floating palette comes close to the toolbar', () => {
    const palette = { left: 600, top: 100, right: 946, bottom: 300 }
    expect(resolveToolbarSide(container, toolbarOnRight, palette)).toBe('left')
  })

  test('ignores a floating palette away from the toolbar band', () => {
    const near = { left: 600, top: 100, right: 900, bottom: 300 }
    const below = { left: 700, top: 470, right: 1000, bottom: 600 }
    expect(resolveToolbarSide(container, toolbarOnRight, near)).toBe('right')
    expect(resolveToolbarSide(container, toolbarOnRight, below)).toBe('right')
  })

  test('stays right when both edges are covered (palette docked to the top)', () => {
    const palette = { left: 0, top: 0, right: 1000, bottom: 300 }
    expect(resolveToolbarSide(container, toolbarOnRight, palette)).toBe('right')
  })
})
