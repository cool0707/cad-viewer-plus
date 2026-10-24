import { ML_THEME_CONFIG } from './theme.config'

/** Brand colours applied by {@link acedApplyBrandTheme}. */
export interface AcEdBrandColors {
  /** Single-colour accent (`#rgb` / `#rrggbb`). */
  primary: string
  /** Gradient start and end colours (left → right). */
  gradient: readonly [string, string] | string[]
}

const STYLE_ID = 'ml-brand-theme'

/** Element Plus dark background, used to derive the dark `light-N` shades. */
const EL_DARK_BG = '#141414'

let currentColors: AcEdBrandColors = {
  primary: ML_THEME_CONFIG.primary,
  gradient: [...ML_THEME_CONFIG.gradient]
}

function parseHex(hex: string): [number, number, number] {
  let h = hex.trim().replace(/^#/, '')
  if (h.length === 3) h = [...h].map(c => c + c).join('')
  if (!/^[0-9a-f]{6}$/i.test(h)) {
    throw new Error(`Invalid theme colour "${hex}" (expected #rgb or #rrggbb)`)
  }
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)) as [
    number,
    number,
    number
  ]
}

/** Same as Sass `color.mix($a, $b, $weight)`: `weight` of `a`, rest of `b`. */
function mix(a: string, b: string, weight: number) {
  const ca = parseHex(a)
  const cb = parseHex(b)
  const rgb = ca.map((v, i) => Math.round(v * weight + cb[i] * (1 - weight)))
  return '#' + rgb.map(v => v.toString(16).padStart(2, '0')).join('')
}

function primaryPalette(primary: string, mixLight: string, mixDark: string) {
  const lines = [`--el-color-primary: ${primary};`]
  for (const i of [3, 5, 7, 8, 9]) {
    lines.push(
      `--el-color-primary-light-${i}: ${mix(mixLight, primary, i / 10)};`
    )
  }
  lines.push(`--el-color-primary-dark-2: ${mix(mixDark, primary, 0.2)};`)
  return lines.join('\n  ')
}

/**
 * Builds the stylesheet that defines the brand CSS variables.
 *
 * @param colors - Brand colours.
 */
export function acedBuildBrandThemeCss(colors: AcEdBrandColors) {
  const { primary } = colors
  const [from, to] = colors.gradient
  parseHex(from)
  parseHex(to)
  // `html:root` / `html.dark:root` outrank Element Plus' `:root` / `html.dark`
  // regardless of stylesheet order.
  return `html:root {
  --ml-brand: ${primary};
  --ml-brand-from: ${from};
  --ml-brand-to: ${to};
  --ml-brand-gradient: linear-gradient(90deg, ${from} 0%, ${to} 100%);
  --ml-brand-soft: color-mix(in srgb, ${primary} 12%, transparent);
  ${primaryPalette(primary, '#ffffff', '#000000')}
}
html.dark:root {
  ${primaryPalette(primary, EL_DARK_BG, '#ffffff')}
}
`
}

/** Returns the brand colours currently applied. */
export function acedGetBrandColors(): AcEdBrandColors {
  return {
    primary: currentColors.primary,
    gradient: [...currentColors.gradient]
  }
}

/**
 * Writes the brand CSS variables (`--ml-brand*`, `--el-color-primary*`) into
 * a `<style>` element of the document. Defaults come from `theme.config.ts`;
 * pass `colors` to override them at runtime. Calling it again only rewrites
 * the stylesheet when the colours changed.
 *
 * @param colors - Optional overrides of the configured colours.
 * @param doc - Target document.
 */
export function acedApplyBrandTheme(
  colors?: Partial<AcEdBrandColors>,
  doc: Document | undefined = typeof document === 'undefined'
    ? undefined
    : document
) {
  if (colors) {
    currentColors = {
      primary: colors.primary ?? currentColors.primary,
      gradient: [...(colors.gradient ?? currentColors.gradient)]
    }
  }
  if (!doc) return
  const css = acedBuildBrandThemeCss(currentColors)
  let style = doc.getElementById(STYLE_ID) as HTMLStyleElement | null
  if (!style) {
    style = doc.createElement('style')
    style.id = STYLE_ID
    ;(doc.head ?? doc.documentElement).appendChild(style)
  }
  if (style.textContent !== css) style.textContent = css
}
