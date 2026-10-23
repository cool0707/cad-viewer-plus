import {
  resolvePointerSelectionAction,
  resolveSelectionActionFromEvent
} from '../src/editor/view/AcEdSelectionAction'

describe('selection action helpers', () => {
  test('plain pointer selection keeps the existing selection set', () => {
    expect(
      resolvePointerSelectionAction({
        shiftKey: false,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe('add')
  })

  test('shift pointer selection removes from the existing selection set', () => {
    expect(
      resolvePointerSelectionAction({
        shiftKey: true,
        ctrlKey: false,
        metaKey: false
      })
    ).toBe('remove')
  })

  test('base resolver still supports explicit replace semantics', () => {
    expect(
      resolveSelectionActionFromEvent(
        {
          shiftKey: false,
          ctrlKey: false,
          metaKey: false
        },
        'replace'
      )
    ).toBe('replace')
  })

  describe('simple style', () => {
    const none = { shiftKey: false, ctrlKey: false, metaKey: false }

    test('plain click replaces the selection set', () => {
      expect(resolvePointerSelectionAction(none, 'simple')).toBe('replace')
      expect(resolvePointerSelectionAction(none, 'simple', false)).toBe(
        'replace'
      )
    })

    test('shift click toggles, shift drag adds', () => {
      const shift = { ...none, shiftKey: true }
      expect(resolvePointerSelectionAction(shift, 'simple', true)).toBe(
        'toggle'
      )
      expect(resolvePointerSelectionAction(shift, 'simple', false)).toBe('add')
    })

    test('ctrl or cmd click adds', () => {
      expect(
        resolvePointerSelectionAction({ ...none, ctrlKey: true }, 'simple')
      ).toBe('add')
      expect(
        resolvePointerSelectionAction({ ...none, metaKey: true }, 'simple')
      ).toBe('add')
    })
  })

  test('cad style ignores the click / drag distinction', () => {
    const shift = { shiftKey: true, ctrlKey: false, metaKey: false }
    expect(resolvePointerSelectionAction(shift, 'cad', false)).toBe('remove')
    expect(
      resolvePointerSelectionAction(
        { shiftKey: false, ctrlKey: false, metaKey: false },
        'cad',
        false
      )
    ).toBe('add')
  })
})
