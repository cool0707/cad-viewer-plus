import type { Plugin } from 'vite'

import { acedBuildBrandThemeCss } from '../cad-simple-viewer/src/theme/AcEdBrandTheme'
import { ML_THEME_CONFIG } from '../cad-simple-viewer/src/theme/theme.config'

/**
 * Writes the brand CSS variables from `theme.config.ts` into every HTML entry,
 * so markup shown before the app script runs (loading spinner, static pages)
 * already uses the theme colours. `acedApplyBrandTheme()` reuses the same
 * `<style id="ml-brand-theme">` at runtime.
 */
export function brandThemeHtml(): Plugin {
  return {
    name: 'ml-brand-theme-html',
    transformIndexHtml() {
      return [
        {
          tag: 'style',
          attrs: { id: 'ml-brand-theme' },
          children: acedBuildBrandThemeCss(ML_THEME_CONFIG),
          injectTo: 'head-prepend'
        }
      ]
    }
  }
}
