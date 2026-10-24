import {
  AcApDocManager,
  acapGetShortCutToolbar,
  type AcUiToolbar
} from '@mlightcad/cad-simple-viewer'
import { nextTick, onMounted, onUnmounted, type Ref, watch } from 'vue'

import { store } from '../app'
import {
  isToolbarCovered,
  ML_TOOLBAR_EDGE_OFFSET,
  type MlToolbarSide,
  resolveToolbarSide
} from './toolbarSide'

/** The tool palette rendered by `MlPaletteManager`. */
const PALETTE_SELECTOR = '.ml-layer-manager'

const hasBox = (el: Element | null | undefined): el is HTMLElement =>
  !!el && el.isConnected && el.getClientRects().length > 0

/** Options for {@link usePaletteToolbarAvoidance}. */
export interface MlPaletteToolbarAvoidanceOptions {
  /** Edge of the vertical toolbar while the palette is not in the way. */
  preferredSide?: MlToolbarSide
  /**
   * Called after a toolbar the user dragged was put back on its edge because
   * the palette covered it (e.g. to forget the stored position).
   */
  onFloatingReset?: () => void
}

/**
 * Moves the vertical toolbar and the shortcut toolbar (undo / redo / erase)
 * to the other edge of the canvas while the tool palette would cover them on
 * their preferred edge, and back when it no longer does. Follows docking,
 * dragging, resizing and collapsing of the palette.
 *
 * A vertical toolbar the user dragged somewhere is left alone unless the
 * palette covers it; then it is docked again (on a free edge) so it cannot get
 * lost behind the palette. Nothing happens while the bar itself is dragged.
 *
 * @param host - Host element of the vertical toolbar (fills the canvas area).
 * @param getToolbar - Returns the vertical toolbar, if created.
 * @param options - Preferred edge and floating-reset callback.
 */
export function usePaletteToolbarAvoidance(
  host: Ref<HTMLElement | null>,
  getToolbar: () => AcUiToolbar | undefined,
  options: MlPaletteToolbarAvoidanceOptions = {}
) {
  const preferredSide = options.preferredSide ?? 'right'
  let palette: HTMLElement | null = null
  let frame = 0
  const observed = new Set<Element>()

  const update = () => {
    const obstacle = hasBox(palette) ? palette.getBoundingClientRect() : null

    const hostEl = host.value
    const toolbar = getToolbar()
    const root = hostEl?.querySelector(':scope > .ml-ex-ui-toolbar')
    if (hostEl && toolbar && hasBox(root)) {
      observe(root)
      const rect = root.getBoundingClientRect()
      if (!toolbar.getFloatingLayout()) {
        toolbar.setPlacement(
          resolveToolbarSide(
            hostEl.getBoundingClientRect(),
            rect,
            obstacle,
            ML_TOOLBAR_EDGE_OFFSET,
            preferredSide
          )
        )
      } else if (
        obstacle &&
        !root.classList.contains('is-dragging') &&
        isToolbarCovered(rect, obstacle)
      ) {
        toolbar.setFloatingLayout(undefined)
        options.onFloatingReset?.()
        // Pick the free edge once the docked bar has been laid out.
        schedule()
      }
    }

    const view = AcApDocManager.instance.curView
    const shortcut = view ? acapGetShortCutToolbar(view) : undefined
    if (shortcut && hasBox(shortcut.shell)) {
      observe(shortcut.shell)
      shortcut.setSide(
        resolveToolbarSide(
          view.container.getBoundingClientRect(),
          shortcut.shell.getBoundingClientRect(),
          obstacle
        )
      )
    }
  }

  const schedule = () => {
    if (frame) return
    frame = requestAnimationFrame(() => {
      frame = 0
      update()
    })
  }

  // Size changes of the palette, the canvas and both toolbars.
  const resizeObserver = new ResizeObserver(schedule)
  // Palette drags and docking only change its inline style / classes.
  const mutationObserver = new MutationObserver(schedule)

  const observe = (el: Element) => {
    if (observed.has(el)) return
    observed.add(el)
    resizeObserver.observe(el)
  }

  const detachPalette = () => {
    if (palette) {
      resizeObserver.unobserve(palette)
      observed.delete(palette)
    }
    mutationObserver.disconnect()
    palette = null
  }

  const attachPalette = () => {
    detachPalette()
    palette = document.querySelector<HTMLElement>(PALETTE_SELECTOR)
    if (palette) {
      observe(palette)
      mutationObserver.observe(palette, {
        attributes: true,
        attributeFilter: ['style', 'class']
      })
    }
  }

  watch(
    () => store.dialogs.layerManager,
    async () => {
      await nextTick()
      attachPalette()
      schedule()
    }
  )

  onMounted(() => {
    if (host.value) observe(host.value)
    window.addEventListener('resize', schedule)
    void nextTick(() => {
      attachPalette()
      schedule()
    })
  })

  onUnmounted(() => {
    if (frame) cancelAnimationFrame(frame)
    window.removeEventListener('resize', schedule)
    resizeObserver.disconnect()
    mutationObserver.disconnect()
    observed.clear()
  })

  return { refresh: schedule }
}
