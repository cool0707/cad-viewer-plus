import { copyFileSync } from 'fs'
import { createRequire } from 'module'
import { resolve } from 'path'
import { defineConfig } from 'vite'

import {
  JWW_PARSER_WASM_FILE,
  JWW_PARSER_WORKER_FILE
} from './src/constants'

const require = createRequire(import.meta.url)

/** Builds dist/jww-parser-worker.js and copies the ezjww wasm next to it. */
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/jwwParserWorker.ts'),
      name: 'jwwParserWorker',
      formats: ['iife'],
      fileName: () => JWW_PARSER_WORKER_FILE
    },
    minify: true
  },
  plugins: [
    {
      name: 'copy-ezjww-wasm',
      closeBundle() {
        copyFileSync(
          require.resolve('ezjww/wasm/ezjww_wasm_bg.wasm'),
          resolve(__dirname, 'dist', JWW_PARSER_WASM_FILE)
        )
      }
    }
  ]
})
