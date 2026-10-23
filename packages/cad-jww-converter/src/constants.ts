/** Converter type (file extension) the JWW converter is registered under. */
export const JWW_FILE_TYPE = 'jww'

/** Parser worker bundle shipped in `dist/`; deploy it with the app. */
export const JWW_PARSER_WORKER_FILE = 'jww-parser-worker.js'

/**
 * ezjww WebAssembly binary shipped in `dist/`. The worker loads it from the
 * same directory as {@link JWW_PARSER_WORKER_FILE}.
 */
export const JWW_PARSER_WASM_FILE = 'jww-parser.wasm'
