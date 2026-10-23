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
import { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

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
for (const [name, src] of apps) {
  cpSync(resolve(root, src), resolve(out, name), { recursive: true })
}
// GitHub Pages: serve files/folders starting with "_" as-is.
writeFileSync(resolve(out, '.nojekyll'), '')

console.log(`Demo site written to ${out}`)
