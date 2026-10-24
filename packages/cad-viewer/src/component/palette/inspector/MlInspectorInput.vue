<template>
  <el-input
    ref="inputRef"
    v-model="draft"
    class="ml-inspector-input"
    :class="{ 'is-numeric': props.numeric }"
    :placeholder="props.mixed ? props.mixedPlaceholder : ''"
    :disabled="props.disabled"
    @change="commit"
    @keydown.esc="revert"
  />
</template>

<script setup lang="ts">
import { ElInput } from 'element-plus'
import { ref, watch } from 'vue'

import { formatInspectorNumber } from '../../../composable/entityInspector'

/**
 * Text / number field of the property inspector.
 *
 * The value is only written back when the edit is confirmed (Enter or
 * leaving the field), so one edit becomes one undo step instead of one per
 * keystroke. Esc restores the current value.
 */
const props = defineProps<{
  modelValue: unknown
  numeric?: boolean
  integer?: boolean
  /** Maximum number of decimals shown (default 6). */
  decimals?: number
  /** The selected entities have different values. */
  mixed?: boolean
  mixedPlaceholder?: string
  disabled?: boolean
}>()

const emit = defineEmits<{
  (e: 'commit', value: string | number): void
}>()

const inputRef = ref<InstanceType<typeof ElInput>>()

/** Formats numbers without trailing zeros. */
function format(value: unknown) {
  if (props.mixed || value == null) return ''
  if (typeof value === 'number') {
    return formatInspectorNumber(value, props.integer ? 0 : props.decimals)
  }
  return String(value)
}

const draft = ref(format(props.modelValue))

watch(
  () => [props.modelValue, props.mixed, props.decimals],
  () => {
    draft.value = format(props.modelValue)
  }
)

function revert() {
  draft.value = format(props.modelValue)
}

function commit() {
  const text = draft.value
  if (text === format(props.modelValue)) return
  if (!props.numeric) {
    emit('commit', text)
    return
  }
  // Accept full-width digits and a comma as decimal separator.
  const normalized = text
    .replace(/[０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xfee0))
    .replace(/[．，]/g, '.')
    .replace(/[－ー−]/g, '-')
    .replace(',', '.')
    .trim()
  const value = Number(normalized)
  if (normalized === '' || !Number.isFinite(value)) {
    revert()
    return
  }
  emit('commit', props.integer ? Math.round(value) : value)
}

defineExpose({
  focus: () => {
    inputRef.value?.focus()
    inputRef.value?.select()
  }
})
</script>

<style scoped>
.ml-inspector-input {
  width: 100%;
}

.ml-inspector-input.is-numeric :deep(input) {
  font-variant-numeric: tabular-nums;
}
</style>
