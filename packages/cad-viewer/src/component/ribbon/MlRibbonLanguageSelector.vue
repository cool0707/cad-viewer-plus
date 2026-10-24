<template>
  <div class="ml-ribbon-language-switch">
    <el-dropdown
      trigger="click"
      :disabled="props.disabled"
      placement="bottom-end"
      popper-class="ml-ribbon-language-switch__popper"
      @command="handleCommand"
    >
      <button
        type="button"
        class="ml-ribbon-language-switch__button"
        :disabled="props.disabled"
        :title="currentLabel"
        :aria-label="`${t('main.statusBar.setting.languageSelector')}: ${currentLabel}`"
      >
        <ml-language-flag :locale="language" :size="20" />
      </button>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item
            v-for="option in LOCALE_OPTIONS"
            :key="option.locale"
            :command="option.locale"
            :class="{
              'is-current': option.locale === language
            }"
          >
            <span class="ml-ribbon-language-switch__item">
              <ml-language-flag :locale="option.locale" :size="18" />
              <span>{{ option.label }}</span>
            </span>
          </el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { AcApLocale } from '@mlightcad/cad-simple-viewer'
import { ElDropdown, ElDropdownItem, ElDropdownMenu } from 'element-plus'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'

import { isSupportedLocale, LOCALE_OPTIONS, useLocale } from '../../composable'
import { LocaleProp } from '../../locale'
import MlLanguageFlag from './MlLanguageFlag.vue'

interface Props {
  currentLocale?: LocaleProp
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  currentLocale: undefined,
  disabled: false
})

const { t } = useI18n()
const { effectiveLocale, setLocale } = useLocale(props.currentLocale)

const language = computed<AcApLocale>(() =>
  isSupportedLocale(effectiveLocale.value) ? effectiveLocale.value : 'en'
)

const currentLabel = computed(
  () =>
    LOCALE_OPTIONS.find(option => option.locale === language.value)?.label ??
    'English'
)

const handleCommand = (value: string) => {
  if (isSupportedLocale(value)) {
    setLocale(value)
  }
}
</script>

<style scoped>
.ml-ribbon-language-switch {
  display: inline-flex;
  align-items: center;
}

.ml-ribbon-language-switch__button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
}

.ml-ribbon-language-switch__button:hover:not(:disabled),
.ml-ribbon-language-switch__button:focus-visible {
  background: var(--ml-brand-soft);
  outline: none;
}

.ml-ribbon-language-switch__button:disabled {
  cursor: not-allowed;
  opacity: 0.5;
}

.ml-ribbon-language-switch__item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
</style>

<style>
.ml-ribbon-language-switch__popper .el-dropdown-menu__item.is-current {
  color: var(--el-color-primary);
  font-weight: 600;
}
</style>
