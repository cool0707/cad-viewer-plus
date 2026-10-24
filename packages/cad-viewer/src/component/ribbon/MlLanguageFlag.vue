<template>
  <span class="ml-language-flag" :style="{ width: sizePx, height: sizePx }">
    <svg viewBox="0 0 32 32" aria-hidden="true">
      <template v-if="props.locale === 'en'">
        <rect width="32" height="32" fill="#012169" />
        <path d="M0 0L32 32M32 0L0 32" stroke="#fff" stroke-width="6" />
        <path d="M0 0L32 32M32 0L0 32" stroke="#C8102E" stroke-width="2" />
        <path d="M16 0V32M0 16H32" stroke="#fff" stroke-width="9" />
        <path d="M16 0V32M0 16H32" stroke="#C8102E" stroke-width="5" />
      </template>
      <template v-else-if="props.locale === 'ja'">
        <rect width="32" height="32" fill="#fff" />
        <circle cx="16" cy="16" r="8.5" fill="#BC002D" />
      </template>
      <template v-else-if="props.locale === 'zh'">
        <rect width="32" height="32" fill="#EE1C25" />
        <polygon :points="star(10, 12, 5, -90)" fill="#FFFF00" />
        <polygon
          v-for="(p, i) in CHINA_SMALL_STARS"
          :key="i"
          :points="star(p[0], p[1], 1.6, towards(p, [10, 12]))"
          fill="#FFFF00"
        />
      </template>
      <template v-else-if="props.locale === 'tr'">
        <rect width="32" height="32" fill="#E30A17" />
        <circle cx="13" cy="16" r="7" fill="#fff" />
        <circle cx="14.8" cy="16" r="5.6" fill="#E30A17" />
        <polygon :points="star(21, 16, 3, 180)" fill="#fff" />
      </template>
      <template v-else-if="props.locale === 'cs'">
        <rect width="32" height="16" fill="#fff" />
        <rect y="16" width="32" height="16" fill="#D7141A" />
        <polygon points="0,0 16,16 0,32" fill="#11457E" />
      </template>
      <template v-else-if="props.locale === 'ar'">
        <rect width="32" height="11" fill="#00732F" />
        <rect y="11" width="32" height="10" fill="#fff" />
        <rect y="21" width="32" height="11" fill="#000" />
        <rect width="9" height="32" fill="#FF0000" />
      </template>
    </svg>
  </span>
</template>

<script setup lang="ts">
import type { AcApLocale } from '@mlightcad/cad-simple-viewer'
import { computed } from 'vue'

/**
 * Round flag icon for a UI locale. Flags are simplified so that they stay
 * recognizable at 20px. Arabic uses the UAE flag as a representative.
 */
const props = withDefaults(
  defineProps<{
    locale: AcApLocale
    size?: number
  }>(),
  { size: 20 }
)

const sizePx = computed(() => `${props.size}px`)

const CHINA_SMALL_STARS: Array<[number, number]> = [
  [16.5, 6.5],
  [19, 9.5],
  [19, 13.5],
  [16.5, 16.5]
]

/** Points of a five-pointed star whose first tip faces `rotDeg`. */
const star = (cx: number, cy: number, r: number, rotDeg: number) => {
  const points: string[] = []
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r : r * 0.382
    const angle = ((rotDeg + i * 36) * Math.PI) / 180
    points.push(
      `${(cx + radius * Math.cos(angle)).toFixed(2)},${(cy + radius * Math.sin(angle)).toFixed(2)}`
    )
  }
  return points.join(' ')
}

const towards = (from: [number, number], to: [number, number]) =>
  (Math.atan2(to[1] - from[1], to[0] - from[0]) * 180) / Math.PI
</script>

<style scoped>
.ml-language-flag {
  display: inline-block;
  flex: none;
  border-radius: 50%;
  overflow: hidden;
  box-shadow: 0 0 0 1px rgba(0, 0, 0, 0.15);
  line-height: 0;
}

.ml-language-flag svg {
  width: 100%;
  height: 100%;
  display: block;
}
</style>
