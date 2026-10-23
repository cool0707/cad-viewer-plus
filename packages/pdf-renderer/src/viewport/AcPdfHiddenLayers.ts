import type { AcDbDatabase } from '@mlightcad/data-model'

import { effectivePdfLayer } from '../pdf/AcPdfEffectiveLayer'
import type { AcPdfEntity } from '../renderer/AcPdfEntity'

/**
 * Layer names that are not displayed in the viewer, split by reason because
 * off and frozen layers hide INSERT contents differently.
 */
export interface AcPdfHiddenLayers {
  /** Layers turned off. */
  off: ReadonlySet<string>
  /** Layers frozen globally. */
  frozen: ReadonlySet<string>
}

/**
 * Collects off / frozen layer names from the layer table.
 *
 * @returns The hidden layers, or `undefined` when every layer is displayed.
 */
export function resolvePdfHiddenLayers(
  db: AcDbDatabase
): AcPdfHiddenLayers | undefined {
  const off = new Set<string>()
  const frozen = new Set<string>()
  for (const layer of db.tables.layerTable.newIterator()) {
    if (layer.isFrozen) {
      frozen.add(layer.name)
    } else if (layer.isOff) {
      off.add(layer.name)
    }
  }
  return off.size > 0 || frozen.size > 0 ? { off, frozen } : undefined
}

/**
 * Marks drawables on hidden layers invisible so they are neither painted nor
 * counted in the page extents.
 *
 * Follows AutoCAD semantics: a frozen INSERT layer hides the whole block
 * reference, while an off INSERT layer only hides the fragments that resolve
 * to it (layer `0` children inherit the INSERT layer). A partly hidden INSERT
 * keeps its full node box in the page extents.
 *
 * @param roots - Page or model-space drawable roots.
 * @param hidden - Hidden layers from {@link resolvePdfHiddenLayers}.
 */
export function hidePdfHiddenLayerGeometry(
  roots: readonly AcPdfEntity[],
  hidden: AcPdfHiddenLayers
): void {
  for (const root of roots) {
    hideNode(root, hidden)
  }
}

function hideNode(
  node: AcPdfEntity,
  hidden: AcPdfHiddenLayers,
  insertLayer?: string,
  parentLayer?: string
): void {
  // Unnamed fragments (e.g. MTEXT runs) belong to their parent's layer.
  const layer = effectivePdfLayer(node.layerName || parentLayer, insertLayer)
  if (hidden.frozen.has(layer)) {
    node.visible = false
    return
  }
  const isInsert = !!node.insertName || node.entityType === 'INSERT'
  if (!isInsert && hidden.off.has(layer)) {
    node.visible = false
    return
  }
  const childInsertLayer = isInsert ? layer : insertLayer
  let anyChildVisible = false
  for (let i = 0; i < node.childCount; i++) {
    const child = node.childAt(i)
    if (child) {
      hideNode(child, hidden, childInsertLayer, layer)
      anyChildVisible ||= child.visible
    }
  }
  // An INSERT whose fragments are all hidden must not keep its box in the
  // page extents.
  if (isInsert && node.childCount > 0 && !anyChildVisible) {
    node.visible = false
  }
}
