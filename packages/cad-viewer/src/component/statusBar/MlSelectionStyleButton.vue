<template>
  <el-tooltip :content="tooltip" :hide-after="0">
    <el-button
      class="ml-selection-style-button"
      :icon="select"
      :aria-pressed="isSimple"
      :style="{ color: iconColor }"
      @click="toggleSelectionStyle"
    />
  </el-tooltip>
</template>

<script lang="ts" setup>
import { AcApSettingManager } from '@mlightcad/cad-simple-viewer'
import { ElButton, ElTooltip } from 'element-plus'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { useSettings } from '../../composable'
import { select } from '../../svg/toolbarIcons'

const features = useSettings()
const { t } = useI18n()

/** `true` when a click replaces the selection, `false` for CAD style. */
const isSimple = computed(() => features.selectionStyle === 'simple')

const tooltip = computed(() =>
  isSimple.value
    ? t('main.statusBar.selectionStyle.simple')
    : t('main.statusBar.selectionStyle.cad')
)

const iconColor = computed(() =>
  isSimple.value ? 'var(--el-color-primary)' : 'var(--el-text-color-regular)'
)

const toggleSelectionStyle = () => {
  AcApSettingManager.instance.selectionStyle = isSimple.value ? 'cad' : 'simple'
}
</script>

<style scoped>
.ml-selection-style-button {
  border: none;
  padding: 0px;
  cursor: pointer;
  width: 30px;
  height: 30px;
}
</style>
