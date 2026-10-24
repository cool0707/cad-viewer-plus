#!/usr/bin/env node
/* global process */
/**
 * Assembles the static demo site into `demo-dist/`:
 *
 *   demo-dist/
 *     index.html            ← demo/index.html (landing page)
 *     cad-viewer/           ← packages/cad-viewer-example/dist
 *     cad-simple-viewer/    ← packages/cad-simple-viewer-example/dist
 *     cad-diff-viewer/      ← packages/cad-diff-viewer-example/dist
 *
 * Run `pnpm build` first (or use `pnpm demo:build`).
 */
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const out = resolve(root, 'demo-dist')

const apps = [
  ['cad-viewer', 'packages/cad-viewer-example/dist'],
  ['cad-simple-viewer', 'packages/cad-simple-viewer-example/dist'],
  ['cad-diff-viewer', 'packages/cad-diff-viewer-example/dist']
]

for (const [, src] of apps) {
  if (!existsSync(resolve(root, src, 'index.html'))) {
    console.error(`Missing ${src}/index.html — run "pnpm build" first.`)
    process.exit(1)
  }
}

rmSync(out, { recursive: true, force: true })
mkdirSync(out, { recursive: true })
cpSync(resolve(root, 'demo'), out, { recursive: true })

// Theme colours for the landing page come from the same config as the apps
// (plain JS syntax, so Node can import the .ts file directly).
const { ML_THEME_CONFIG } = await import(
  pathToFileURL(
    resolve(root, 'packages/cad-simple-viewer/src/theme/theme.config.ts')
  ).href
)
const landing = resolve(out, 'index.html')
writeFileSync(
  landing,
  readFileSync(landing, 'utf8').replace(
    '</head>',
    `  <style id="ml-brand-theme">:root { --ml-brand: ${ML_THEME_CONFIG.primary}; ` +
      `--ml-brand-gradient: linear-gradient(90deg, ${ML_THEME_CONFIG.gradient.join(', ')}); }</style>\n  </head>`
  )
)
for (const [name, src] of apps) {
  cpSync(resolve(root, src), resolve(out, name), { recursive: true })
}
// GitHub Pages: serve files/folders starting with "_" as-is.
writeFileSync(resolve(out, '.nojekyll'), '')

console.log(`Demo site written to ${out}`)
