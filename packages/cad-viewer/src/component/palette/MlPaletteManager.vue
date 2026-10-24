<template>
  <el-config-provider :size="'small'">
    <ml-tool-palette
      ref="paletteRef"
      class="ml-layer-manager"
      :style="paletteStyle"
      v-model="store.dialogs.layerManager"
      v-model:dock-side="dockSide"
      :title="activeTabTitle"
      :left-offset="paletteOffsets.left"
      :right-offset="paletteOffsets.right"
      :top-offset="paletteOffsets.top"
      :bottom-offset="paletteOffsets.bottom"
    >
      <ml-overflow-tabs
        v-model="store.dialogs.activePaletteTab"
        :tabs="tabs"
      >
        <div
          v-if="store.dialogs.activePaletteTab === 'layerManager'"
          class="ml-layer-list-wrapper"
        >
          <ml-layer-list :editor="props.editor" />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'entityProperties'"
          class="ml-entity-properties-wrapper"
        >
          <ml-entity-properties :selection-ids="selectionSet" />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'countList'"
          class="ml-count-list-wrapper"
        >
          <ml-count-list />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'find'"
          class="ml-find-palette-wrapper"
        >
          <ml-find-palette />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'designReview'"
          class="ml-design-review-wrapper"
        >
          <ml-design-review-palette />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'measurements'"
          class="ml-measurement-palette-wrapper"
        >
          <ml-measurement-palette />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'missingResources'"
          class="ml-missing-resources-wrapper"
        >
          <ml-missing-resources />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'memoryProfile'"
          class="ml-memory-profile-wrapper"
        >
          <ml-memory-profile />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'openFileProfile'"
          class="ml-open-file-profile-wrapper"
        >
          <ml-open-file-profile />
        </div>
        <div
          v-else-if="store.dialogs.activePaletteTab === 'blocks'"
          class="ml-blocks-palette-wrapper"
        >
          <ml-blocks-palette />
        </div>
        <div
          v-else-if="
            store.features.agentPlugin &&
            store.dialogs.activePaletteTab === 'agent'
          "
          class="ml-agent-palette-wrapper"
        >
          <agent-chat-panel embedded />
        </div>
        <div
          v-else-if="
            store.features.scriptPlugin &&
            store.dialogs.activePaletteTab === 'cadScript'
          "
          class="ml-agent-palette-wrapper"
        >
          <ml-cad-script-panel />
        </div>
      </ml-overflow-tabs>
    </ml-tool-palette>
  </el-config-provider>
</template>

<script setup lang="ts">
import { AcApDocManager, eventBus } from '@mlightcad/cad-simple-viewer'
import {
  type MlOverflowTab,
  MlOverflowTabs,
  MlToolPalette
} from '@mlightcad/ui-components'
import { useResizeObserver } from '@vueuse/core'
import { ElConfigProvider } from 'element-plus'
import {
  computed,
  defineAsyncComponent,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch
} from 'vue'
import { useI18n } from 'vue-i18n'

import { store } from '../../app'
import {
  pendingSymbolPropertyFocus,
  useSelectionSet,
  useViewerRect
} from '../../composable'
import { toolPaletteTabName, toolPaletteTitle } from '../../locale'
import MlBlocksPalette from './MlBlocksPalette.vue'
import MlCadScriptPanel from './MlCadScriptPanel.vue'
import MlCountList from './MlCountList.vue'
import MlDesignReviewPalette from './MlDesignReviewPalette.vue'
import MlEntityProperties from './MlEntityProperties.vue'
import MlFindPalette from './MlFindPalette.vue'
import MlLayerList from './MlLayerList.vue'
import MlMeasurementPalette from './MlMeasurementPalette.vue'
import MlMemoryProfile from './MlMemoryProfile.vue'
import MlMissingResources from './MlMissingResources.vue'
import MlOpenFileProfile from './MlOpenFileProfile.vue'

const loadAgentPlugin = () =>
  Promise.all([
    import('@mlightcad/cad-agent-plugin/style.css'),
    import('@mlightcad/cad-agent-plugin')
  ]).then(([, module]) => module)

const AgentChatPanel = defineAsyncComponent(() =>
  loadAgentPlugin().then(module => module.AgentChatPanel)
)

/**
 * Properties of palette manager component
 */
interface Props {
  /**
   * Current editor
   */
  editor: AcApDocManager
}

const props = defineProps<Props>()
const { t } = useI18n()
const containerRect = useViewerRect()

const DEFAULT_WIDTH = 520
const DEFAULT_HEIGHT = 500
const FLOATING_LEFT_OFFSET = 2
const FLOATING_TOP_OFFSET = 2

const clamp = (value: number, min: number, max: number) => {
  return Math.min(Math.max(value, min), max)
}

const paletteOffsets = computed(() => {
  const { top, left, width, height } = containerRect.value
  const right = left + width
  const bottom = top + height

  return {
    top,
    left,
    right: Math.max(0, window.innerWidth - right),
    bottom: Math.max(0, window.innerHeight - bottom)
  }
})

const paletteStyle = computed(() => {
  const { top, left, width, height } = containerRect.value
  const safeWidth = width > 0 ? width : DEFAULT_WIDTH
  const safeHeight = height > 0 ? height : DEFAULT_HEIGHT
  return {
    '--ml-palette-left': `${left + FLOATING_LEFT_OFFSET}px`,
    '--ml-palette-top': `${top + FLOATING_TOP_OFFSET}px`,
    '--ml-palette-width': `${Math.min(DEFAULT_WIDTH, safeWidth)}px`,
    '--ml-palette-height': `${Math.min(DEFAULT_HEIGHT, safeHeight)}px`,
    '--ml-palette-max-width': `${safeWidth}px`,
    '--ml-palette-max-height': `${safeHeight}px`
  }
})

const syncPaletteToContainer = () => {
  if (!store.dialogs.layerManager) return

  const paletteElement =
    document.querySelector<HTMLElement>('.ml-layer-manager')
  if (!paletteElement) return

  const {
    top,
    left,
    width: containerWidth,
    height: containerHeight
  } = containerRect.value
  if (containerWidth <= 0 || containerHeight <= 0) return

  const right = left + containerWidth
  const bottom = top + containerHeight
  const rect = paletteElement.getBoundingClientRect()
  const width = Math.min(rect.width || DEFAULT_WIDTH, containerWidth)
  const height = Math.min(rect.height || DEFAULT_HEIGHT, containerHeight)
  const isDockedLeft = rect.left <= left + 1
  const isDockedRight = rect.right >= right - 1
  // Geometric proximity alone is not enough: a floating palette sits only a
  // couple of pixels inside the viewer edge. Only stretch when already at
  // docked (full) height so Undock cannot be overwritten back to full-size.
  const isSideDocked =
    (isDockedLeft || isDockedRight) && height >= containerHeight - 1

  const nextLeft = isDockedLeft
    ? left
    : isDockedRight
      ? Math.max(left, right - width)
      : clamp(rect.left, left, Math.max(left, right - width))
  const nextTop = isSideDocked
    ? top
    : clamp(rect.top, top, Math.max(top, bottom - height))
  const nextHeight = isSideDocked ? containerHeight : height

  paletteElement.style.left = `${nextLeft}px`
  paletteElement.style.top = `${nextTop}px`
  paletteElement.style.width = `${width}px`
  paletteElement.style.height = `${nextHeight}px`
  paletteElement.style.maxHeight = `${containerHeight}px`
  paletteElement.style.maxWidth = `${containerWidth}px`
}

// Dock to the right by default. The viewer rect changes a few times while the
// ribbon renders, so dock once it has settled; docking against a stale rect
// leaves the palette over the ribbon. The palette has no close button (hidden
// in CSS): it can only be collapsed to its title bar.
const INITIAL_DOCK_DELAY = 100
type DockSide = 'float' | 'left' | 'top' | 'bottom' | 'right'
const dockSide = ref<DockSide | undefined>()
let initialDockTimer: ReturnType<typeof setTimeout> | undefined
const stopInitialDock = watch(
  containerRect,
  rect => {
    clearTimeout(initialDockTimer)
    if (rect.width <= 0 || rect.height <= 0) return
    initialDockTimer = setTimeout(() => {
      stopInitialDock()
      dockSide.value = 'right'
    }, INITIAL_DOCK_DELAY)
  },
  { immediate: true }
)
onBeforeUnmount(() => {
  clearTimeout(initialDockTimer)
  stopInitialDock()
  Object.assign(store.paletteDockInsets, { left: 0, right: 0, top: 0, bottom: 0 })
})

// Publish the space a docked palette takes so the canvas shrinks around it
// (collapsing the palette gives the space back).
const paletteRef = ref<InstanceType<typeof MlToolPalette>>()
const updatePaletteDockInsets = () => {
  const insets = { left: 0, right: 0, top: 0, bottom: 0 }
  const element = paletteRef.value?.$el as HTMLElement | undefined
  const side = dockSide.value
  const { top, left, width, height } = containerRect.value
  if (
    element instanceof HTMLElement &&
    store.dialogs.layerManager &&
    side &&
    side !== 'float'
  ) {
    const rect = element.getBoundingClientRect()
    const extent = {
      left: rect.right - left,
      right: left + width - rect.left,
      top: rect.bottom - top,
      bottom: top + height - rect.top
    }[side]
    const max = side === 'left' || side === 'right' ? width : height
    insets[side] = clamp(Math.round(extent), 0, max)
  }
  const current = store.paletteDockInsets
  if (
    current.left !== insets.left ||
    current.right !== insets.right ||
    current.top !== insets.top ||
    current.bottom !== insets.bottom
  ) {
    Object.assign(current, insets)
  }
}
useResizeObserver(paletteRef, updatePaletteDockInsets)
watch(dockSide, async () => {
  await nextTick()
  updatePaletteDockInsets()
})

const baseTabNames = [
  'layerManager',
  'entityProperties',
  'countList',
  'find',
  'designReview',
  'measurements',
  'blocks',
  'missingResources',
  'memoryProfile'
] as const
const tabNames = computed((): readonly string[] => {
  const names: string[] = [...baseTabNames]
  // Revealed by OPENPERF only — keep out of the default palette chrome.
  if (store.dialogs.openFileProfileTabVisible) {
    names.push('openFileProfile')
  }
  if (store.features.agentPlugin) {
    names.push('agent')
  }
  if (store.features.scriptPlugin) {
    names.push('cadScript')
  }
  return names
})

const tabs = computed<MlOverflowTab[]>(() => {
  return tabNames.value.map(name => {
    return {
      name,
      label:
        name === 'cadScript'
          ? t('main.toolPalette.script.scriptTab')
          : toolPaletteTabName(name)
    }
  })
})

const activeTabTitle = computed(() => {
  if (store.dialogs.activePaletteTab === 'cadScript') {
    return t('main.toolPalette.script.scriptTitle')
  }
  return toolPaletteTitle(store.dialogs.activePaletteTab)
})

watch(
  [() => store.dialogs.activePaletteTab, tabNames],
  ([activeTab, names]) => {
    if (!names.includes(activeTab)) {
      store.dialogs.activePaletteTab = names[0]
    }
  },
  { immediate: true }
)

watch(
  () => [containerRect.value, store.dialogs.layerManager],
  async () => {
    await nextTick()
    syncPaletteToContainer()
    updatePaletteDockInsets()
  },
  { immediate: true, deep: true }
)

const { selectionSet } = useSelectionSet()

// Double-clicking a symbol in the simple selection style edits its symbol
// properties here instead of opening the attribute editor dialog.
const focusSymbolProperty = (args: { objectId: string; tag?: string }) => {
  store.dialogs.layerManager = true
  store.dialogs.activePaletteTab = 'entityProperties'
  pendingSymbolPropertyFocus.value = { objectId: args.objectId, tag: args.tag }
}
onMounted(() => eventBus.on('focus-symbol-property', focusSymbolProperty))
onBeforeUnmount(() => eventBus.off('focus-symbol-property', focusSymbolProperty))
</script>

<style scoped>
.ml-layer-manager {
  left: var(--ml-palette-left);
  top: var(--ml-palette-top);
  width: var(--ml-palette-width);
  height: var(--ml-palette-height);
  max-width: var(--ml-palette-max-width);
  max-height: var(--ml-palette-max-height);
  z-index: 7;
}

.ml-layer-manager :deep(.ml-tool-palette-action-close) {
  display: none;
}

.ml-layer-list-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-entity-properties-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.ml-count-list-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-find-palette-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-design-review-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-measurement-palette-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-missing-resources-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-memory-profile-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-open-file-profile-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-blocks-palette-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-agent-palette-wrapper {
  overflow: hidden;
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
}

.ml-agent-palette-wrapper :deep(.cad-agent-panel-root) {
  flex: 1;
  min-height: 0;
}
</style>
