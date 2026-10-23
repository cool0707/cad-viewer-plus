import { resolve } from 'path'
import peerDepsExternal from 'rollup-plugin-peer-deps-external'
import { defineConfig, PluginOption } from 'vite'

import {
  createLibEntryFileName,
  createLibRollupOutput
} from '../vite-config/pluginRollupOutput'

const pluginId = 'cad-jww-converter'

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: { index: resolve(__dirname, 'src/index.ts') },
      name: pluginId,
      // ES only: the main-thread fallback lazily imports ezjww, which a UMD
      // bundle would have to inline.
      formats: ['es'],
      fileName: (format, entryName) =>
        createLibEntryFileName(pluginId, format, entryName)
    },
    minify: true,
    rollupOptions: {
      // The parser runs in jww-parser-worker.js; keep the wasm glue out of
      // the main bundle (it is only imported for main-thread parsing).
      external: ['ezjww'],
      output: createLibRollupOutput(pluginId)
    }
  },
  plugins: [peerDepsExternal() as PluginOption]
})
