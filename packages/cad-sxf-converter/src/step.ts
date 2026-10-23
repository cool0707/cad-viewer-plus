/**
 * ISO 10303-21 (STEP physical file) reader shared by SXF P21 and SFC.
 *
 * SFC keeps the Part 21 frame but stores each feature inside a comment block
 * (`/*SXF #10 = line_feature(...) SXF*\/`) whose strings may be quoted with
 * `\'…\'`. The value grammar follows ezsxf's parser (MIT,
 * https://github.com/monozukuri-ai/ezsxf, `src/parser.rs`).
 */

/** A Part 21 parameter value. */
export type StepValue =
  | { kind: 'unset' } // $
  | { kind: 'omitted' } // *
  | { kind: 'ref'; id: number }
  | { kind: 'string'; value: string }
  | { kind: 'binary'; value: string }
  | { kind: 'enum'; value: string }
  | { kind: 'integer'; value: number }
  | { kind: 'real'; value: number }
  | { kind: 'list'; values: StepValue[] }
  | { kind: 'typed'; keyword: string; params: StepValue[] }

/** One simple record `KEYWORD(params)`. */
export interface StepRecord {
  keyword: string
  params: StepValue[]
}

/** `#id = record;` or a complex `#id = (A() B());` instance. */
export interface StepEntity {
  id: number
  records: StepRecord[]
}

export class StepSyntaxError extends Error {}

/** Character-level reader over Part 21 text. */
export class StepReader {
  index = 0

  constructor(
    readonly text: string,
    /** SFC: backslashes in strings are literal and `\'…\'` quotes strings. */
    readonly sfc = false
  ) {}

  get eof() {
    return this.index >= this.text.length
  }

  peek(offset = 0) {
    return this.text[this.index + offset]
  }

  skipWs() {
    const text = this.text
    while (this.index < text.length) {
      const ch = text.charCodeAt(this.index)
      if (ch === 32 || ch === 9 || ch === 10 || ch === 13) {
        this.index++
      } else if (
        !this.sfc &&
        ch === 47 /* / */ &&
        text.charCodeAt(this.index + 1) === 42 /* * */
      ) {
        // Part 21 comment.
        const end = text.indexOf('*/', this.index + 2)
        this.index = end < 0 ? text.length : end + 2
      } else {
        break
      }
    }
  }

  expect(ch: string) {
    this.skipWs()
    if (this.text[this.index] !== ch) {
      throw this.error(`Expected '${ch}'`)
    }
    this.index++
  }

  tryConsume(ch: string) {
    this.skipWs()
    if (this.text[this.index] === ch) {
      this.index++
      return true
    }
    return false
  }

  error(message: string) {
    const line = this.text.slice(0, this.index).split('\n').length
    return new StepSyntaxError(`${message} (line ${line})`)
  }

  keyword() {
    this.skipWs()
    const start = this.index
    while (
      this.index < this.text.length &&
      /[A-Za-z0-9_-]/.test(this.text[this.index])
    ) {
      this.index++
    }
    if (start === this.index) throw this.error('Expected a keyword')
    return this.text.slice(start, this.index)
  }

  /** `#123 = …;` (the `;` is consumed for P21 only). */
  entity(): StepEntity {
    this.expect('#')
    const id = this.integerToken()
    this.expect('=')
    const records: StepRecord[] = []
    this.skipWs()
    if (this.peek() === '(') {
      this.index++
      while (!this.tryConsume(')')) records.push(this.record())
    } else {
      records.push(this.record())
    }
    return { id, records }
  }

  record(): StepRecord {
    const keyword = this.keyword()
    this.expect('(')
    return { keyword, params: this.listUntil(')') }
  }

  listUntil(end: string): StepValue[] {
    const values: StepValue[] = []
    if (this.tryConsume(end)) return values
    for (;;) {
      values.push(this.value())
      if (this.tryConsume(end)) return values
      this.expect(',')
    }
  }

  value(): StepValue {
    this.skipWs()
    const ch = this.peek()
    switch (ch) {
      case '$':
        this.index++
        return { kind: 'unset' }
      case '*':
        this.index++
        return { kind: 'omitted' }
      case '#':
        this.index++
        return { kind: 'ref', id: this.integerToken() }
      case '\'':
        return { kind: 'string', value: this.quoted() }
      case '"': {
        const end = this.text.indexOf('"', this.index + 1)
        if (end < 0) throw this.error('Unterminated binary literal')
        const value = this.text.slice(this.index + 1, end)
        this.index = end + 1
        return { kind: 'binary', value }
      }
      case '(':
        this.index++
        return { kind: 'list', values: this.listUntil(')') }
      case '.': {
        const end = this.text.indexOf('.', this.index + 1)
        if (end < 0) throw this.error('Unterminated enumeration')
        const value = this.text.slice(this.index + 1, end)
        this.index = end + 1
        return { kind: 'enum', value }
      }
      case '\\':
        if (this.peek(1) === '\'') {
          return { kind: 'string', value: this.backslashQuoted() }
        }
        break
      default:
        if (ch !== undefined && /[-+0-9]/.test(ch)) return this.number()
        if (ch !== undefined && /[A-Za-z_]/.test(ch)) {
          const keyword = this.keyword()
          this.expect('(')
          return { kind: 'typed', keyword, params: this.listUntil(')') }
        }
    }
    throw this.error(`Unexpected character '${ch ?? 'EOF'}'`)
  }

  private integerToken() {
    const match = /^\d+/.exec(this.text.slice(this.index, this.index + 20))
    if (!match) throw this.error('Expected digits')
    this.index += match[0].length
    return Number(match[0])
  }

  private number(): StepValue {
    const match = /^[-+]?\d*(\.\d*)?([eE][-+]?\d+)?/.exec(
      this.text.slice(this.index, this.index + 64)
    )
    if (!match || match[0] === '' || match[0] === '-' || match[0] === '+') {
      throw this.error('Invalid number')
    }
    this.index += match[0].length
    const value = Number(match[0])
    return match[1] !== undefined || match[2] !== undefined
      ? { kind: 'real', value }
      : { kind: 'integer', value }
  }

  /** `'…'` with `''` for a quote; `\\` is one backslash. */
  private quoted() {
    const text = this.text
    let out = ''
    let i = this.index + 1
    for (;;) {
      if (i >= text.length) throw this.error('Unterminated string')
      const ch = text[i]
      if (ch === '\'') {
        if (text[i + 1] === '\'') {
          out += '\''
          i += 2
          continue
        }
        i++
        break
      }
      if (ch === '\\' && text[i + 1] === '\\') {
        out += '\\'
        i += 2
        continue
      }
      out += ch
      i++
    }
    this.index = i
    return this.sfc ? out : decodeStepString(out)
  }

  /** SFC `\'…\'`: only backslash + quote terminates. */
  private backslashQuoted() {
    const text = this.text
    let out = ''
    let i = this.index + 2
    for (;;) {
      if (i >= text.length) throw this.error('Unterminated string')
      const ch = text[i]
      if (ch === '\\' && text[i + 1] === '\'') {
        i += 2
        break
      }
      if (ch === '\\' && text[i + 1] === '\\') {
        out += '\\'
        i += 2
        continue
      }
      out += ch
      i++
    }
    this.index = i
    return out
  }
}

/**
 * Decodes Part 21 string control directives: `\X2\…\X0\` (UTF-16),
 * `\X4\…\X0\` (UTF-32), `\X\hh` (ISO 8859-1) and `\S\c`. A doubled
 * backslash has already been reduced by the tokenizer, so any directive here
 * came from the file.
 */
export function decodeStepString(value: string) {
  if (!value.includes('\\')) return value
  return value
    .replace(/\\X2\\([0-9A-Fa-f]*)\\X0\\/g, (_, hex: string) => {
      let out = ''
      for (let i = 0; i + 4 <= hex.length; i += 4) {
        out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16))
      }
      return out
    })
    .replace(/\\X4\\([0-9A-Fa-f]*)\\X0\\/g, (_, hex: string) => {
      let out = ''
      for (let i = 0; i + 8 <= hex.length; i += 8) {
        out += String.fromCodePoint(parseInt(hex.slice(i, i + 8), 16))
      }
      return out
    })
    .replace(/\\X\\([0-9A-Fa-f]{2})/g, (_, hex: string) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\S\\(.)/g, (_, ch: string) =>
      String.fromCharCode(ch.charCodeAt(0) + 128)
    )
    .replace(/\\P[A-I]\\/g, '')
}

/**
 * Decodes file bytes: UTF-8 when valid, otherwise Shift_JIS (CP932), which
 * SFC uses.
 */
export function decodeSxfBytes(data: Uint8Array) {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(data)
  } catch {
    return new TextDecoder('shift_jis').decode(data)
  }
}

/** Value helpers matching ezsxf's lenient SFC coercions (numbers in strings). */
export function asNumber(value: StepValue | undefined): number | undefined {
  if (!value) return undefined
  switch (value.kind) {
    case 'integer':
    case 'real':
      return value.value
    case 'string': {
      const trimmed = value.value.trim()
      if (trimmed === '') return undefined
      const n = Number(trimmed)
      return Number.isFinite(n) ? n : undefined
    }
    case 'typed':
      // e.g. POSITIVE_LENGTH_MEASURE(0.13)
      return value.params.length === 1 ? asNumber(value.params[0]) : undefined
    default:
      return undefined
  }
}

export function asString(value: StepValue | undefined): string | undefined {
  if (!value) return undefined
  if (value.kind === 'string' || value.kind === 'enum') return value.value
  if (value.kind === 'typed' && value.params.length === 1) {
    return asString(value.params[0])
  }
  return undefined
}

export function asNumberList(
  value: StepValue | undefined
): number[] | undefined {
  if (!value) return undefined
  if (value.kind === 'list') {
    const out: number[] = []
    for (const item of value.values) {
      const n = asNumber(item)
      if (n === undefined) return undefined
      out.push(n)
    }
    return out
  }
  if (value.kind === 'string') {
    const inner = value.value
      .trim()
      .replace(/^\(/, '')
      .replace(/\)$/, '')
      .trim()
    if (inner === '') return []
    const out = inner.split(',').map(s => Number(s.trim()))
    return out.every(Number.isFinite) ? out : undefined
  }
  return undefined
}

export function asRef(value: StepValue | undefined): number | undefined {
  return value?.kind === 'ref' ? value.id : undefined
}

export function asRefList(value: StepValue | undefined): number[] {
  if (value?.kind !== 'list') return []
  return value.values.flatMap(v => (v.kind === 'ref' ? [v.id] : []))
}
