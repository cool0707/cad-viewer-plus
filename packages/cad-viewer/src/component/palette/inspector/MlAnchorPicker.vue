<template>
  <div
    class="ml-anchor-picker"
    role="radiogroup"
    :aria-label="
      t('main.toolPalette.entityProperties.propertyPanel.referencePoint')
    "
  >
    <button
      v-for="cell in cells"
      :key="cell.id"
      type="button"
      role="radio"
      class="ml-anchor-picker__cell"
      :class="{ 'is-active': isActive(cell) }"
      :aria-checked="isActive(cell)"
      :title="cellTitle(cell.id)"
      :disabled="props.disabled"
      @click="emit('update:modelValue', { x: cell.x, y: cell.y })"
    >
      <span class="ml-anchor-picker__dot" />
    </button>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n'

import type { MlAnchor } from '../../../composable/entityInspector'

/**
 * Illustrator-style 9-point selector for the reference point of the
 * selection's X / Y fields (and the fixed point when resizing).
 */
const props = defineProps<{
  modelValue: MlAnchor
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: MlAnchor): void
}>()

const { t } = useI18n()

type Cell = { id: string; x: MlAnchor['x']; y: MlAnchor['y'] }

// Top row first (Y is up in drawings).
const cells: Cell[] = [
  { id: 'topLeft', x: 0, y: 1 },
  { id: 'top', x: 0.5, y: 1 },
  { id: 'topRight', x: 1, y: 1 },
  { id: 'left', x: 0, y: 0.5 },
  { id: 'center', x: 0.5, y: 0.5 },
  { id: 'right', x: 1, y: 0.5 },
  { id: 'bottomLeft', x: 0, y: 0 },
  { id: 'bottom', x: 0.5, y: 0 },
  { id: 'bottomRight', x: 1, y: 0 }
]

function isActive(cell: Cell) {
  return props.modelValue.x === cell.x && props.modelValue.y === cell.y
}

function cellTitle(id: string) {
  // eslint-disable-next-line @intlify/vue-i18n/no-dynamic-keys -- one key per cell
  return `${t('main.toolPalette.entityProperties.propertyPanel.referencePoint')}: ${t(
    `main.toolPalette.entityProperties.propertyPanel.anchor.${id}`
  )}`
}
</script>

<style scoped>
.ml-anchor-picker {
  display: grid;
  grid-template-columns: repeat(3, 14px);
  grid-template-rows: repeat(3, 14px);
  gap: 2px;
  padding: 3px;
  border: 1px solid var(--el-border-color);
  border-radius: 4px;
  background: var(--el-fill-color-blank);
}

.ml-anchor-picker__cell {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}

.ml-anchor-picker__cell:disabled {
  cursor: default;
}

.ml-anchor-picker__dot {
  width: 6px;
  height: 6px;
  border-radius: 1px;
  background: var(--el-border-color-darker);
}

.ml-anchor-picker__cell:hover .ml-anchor-picker__dot {
  background: var(--el-text-color-secondary);
}

.ml-anchor-picker__cell.is-active .ml-anchor-picker__dot {
  width: 8px;
  height: 8px;
  background: var(--el-color-primary);
}
</style>
