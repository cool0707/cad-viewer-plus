#!/usr/bin/env node
/* global process */
/**
 * Minimal static server for `demo-dist/` (no dependencies).
 *
 *   node tools/serve-demo.mjs [port]   → http://localhost:4300/
 */
import { createReadStream, existsSync, statSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, extname, join, normalize, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../demo-dist')
const port = Number(process.argv[2] ?? process.env.PORT ?? 4300)

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.wasm': 'application/wasm',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.dxf': 'application/dxf',
  '.dwg': 'application/acad',
  '.txt': 'text/plain; charset=utf-8'
}

if (!existsSync(root)) {
  console.error('demo-dist/ not found — run "pnpm demo:build" first.')
  process.exit(1)
}

createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let file = normalize(join(root, pathname))
  if (!file.startsWith(root)) {
    res.writeHead(403).end()
    return
  }
  if (existsSync(file) && statSync(file).isDirectory()) {
    if (!pathname.endsWith('/')) {
      res.writeHead(301, { Location: `${pathname}/` }).end()
      return
    }
    file = join(file, 'index.html')
  }
  if (!existsSync(file)) {
    res.writeHead(404).end('Not found')
    return
  }
  res.writeHead(200, {
    'Content-Type': TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream'
  })
  createReadStream(file).pipe(res)
}).listen(port, () => {
  console.log(`Demo: http://localhost:${port}/`)
})
