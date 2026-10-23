import type { MTextInputBox } from '@mlightcad/mtext-input-box'
import * as THREE from 'three'

/** Runtime fields of `MTextInputBox` that are private in its typings. */
interface MTextInputBoxImeRuntime {
  imeInput?: HTMLTextAreaElement | null
  camera?: THREE.Camera
  imeTarget?: HTMLElement | null
}

/** Options of {@link AcEdMTextCompositionPreview}. */
export interface AcEdMTextCompositionPreviewOptions {
  /** Document hosting the editor (the view's `ownerDocument`). */
  ownerDocument: Document
  /** CSS color of the preview text. */
  textColor: string
  /**
   * CSS color painted behind the preview so it stays readable over existing
   * text and drawing linework.
   */
  backgroundColor: string
  /** CSS font family of the preview text. */
  fontFamily: string
}

/**
 * Shows the in-progress IME composition (e.g. Japanese kana before kanji
 * conversion) next to the MTEXT caret.
 *
 * `MTextInputBox` receives keyboard input through an invisible 2px textarea
 * and only inserts text on `compositionend`, so without this overlay the
 * user cannot see what they are converting. The overlay mimics inline
 * composition in word processors: same size as the text being typed,
 * underlined, placed at the caret.
 */
export class AcEdMTextCompositionPreview {
  private readonly element: HTMLDivElement
  private composing = false
  private text = ''

  private readonly doc: Document

  /**
   * @param inputBox - Editor whose hidden IME textarea is observed.
   * @param options - Where and how the preview is drawn.
   */
  constructor(
    private readonly inputBox: MTextInputBox,
    options: AcEdMTextCompositionPreviewOptions
  ) {
    const doc = options.ownerDocument
    this.doc = doc
    this.element = doc.createElement('div')
    this.element.className = 'ml-mtext-ime-composition'
    this.element.setAttribute('aria-hidden', 'true')
    Object.assign(this.element.style, {
      position: 'fixed',
      display: 'none',
      pointerEvents: 'none',
      whiteSpace: 'pre',
      lineHeight: '1.2',
      padding: '0 1px',
      color: options.textColor,
      background: options.backgroundColor,
      fontFamily: options.fontFamily,
      textDecoration: 'underline',
      textDecorationThickness: '1px',
      textUnderlineOffset: '0.15em',
      zIndex: '2147483646'
    })
    doc.body.appendChild(this.element)
    // Capture on the document: the textarea is recreated whenever the editor
    // is deactivated and reactivated.
    doc.addEventListener('compositionstart', this.onCompositionStart, true)
    doc.addEventListener('compositionupdate', this.onCompositionUpdate, true)
    doc.addEventListener('compositionend', this.onCompositionEnd, true)
  }

  /** Whether an IME composition is currently in progress. */
  get isComposing() {
    return this.composing
  }

  /** Current composition string (empty when not composing). */
  get compositionText() {
    return this.text
  }

  /** Repositions the overlay at the caret. Call once per render frame. */
  update() {
    if (!this.composing || !this.text) {
      this.element.style.display = 'none'
      return
    }
    const runtime = this.inputBox as unknown as MTextInputBoxImeRuntime
    const camera = runtime.camera
    const target = runtime.imeTarget
    if (!camera || !target) return

    const rect = target.getBoundingClientRect()
    const toScreen = (x: number, y: number, z: number) => {
      const p = new THREE.Vector3(x, y, z).project(camera)
      return {
        x: rect.left + (p.x + 1) * 0.5 * rect.width,
        y: rect.top + (1 - p.y) * 0.5 * rect.height
      }
    }
    const caret = this.inputBox.getCursorWorldPosition()
    const worldHeight = Math.max(this.inputBox.getCurrentFormat().fontSize, 0)
    const center = toScreen(caret.x, caret.y, caret.z)
    const top = toScreen(caret.x, caret.y + worldHeight, caret.z)
    // MTEXT height is the cap height; a CSS font-size of ~1.4x that renders
    // capitals at roughly the same size as the drawn text.
    const fontPx = Math.min(Math.max(Math.abs(center.y - top.y) * 1.4, 12), 200)

    this.element.textContent = this.text
    Object.assign(this.element.style, {
      display: 'block',
      fontSize: `${fontPx}px`,
      left: `${Math.round(center.x)}px`,
      top: `${Math.round(center.y - fontPx * 0.6)}px`
    })
  }

  /** Removes the overlay and its listeners. */
  dispose() {
    const doc = this.doc
    doc.removeEventListener('compositionstart', this.onCompositionStart, true)
    doc.removeEventListener('compositionupdate', this.onCompositionUpdate, true)
    doc.removeEventListener('compositionend', this.onCompositionEnd, true)
    this.element.remove()
  }

  private isOwnImeEvent(event: Event) {
    const runtime = this.inputBox as unknown as MTextInputBoxImeRuntime
    return !!runtime.imeInput && event.target === runtime.imeInput
  }

  private readonly onCompositionStart = (event: CompositionEvent) => {
    if (!this.isOwnImeEvent(event)) return
    this.composing = true
    this.text = ''
    this.update()
  }

  private readonly onCompositionUpdate = (event: CompositionEvent) => {
    if (!this.isOwnImeEvent(event)) return
    this.composing = true
    this.text = event.data ?? ''
    this.update()
  }

  private readonly onCompositionEnd = (event: CompositionEvent) => {
    if (!this.isOwnImeEvent(event)) return
    this.composing = false
    this.text = ''
    this.update()
  }
}
