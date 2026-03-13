/* eslint-disable @typescript-eslint/no-explicit-any */
import { LogFormatter } from '../src/utils/formatter'
import type { LogEntry } from '../src/core/types'

function makeEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    level: 'info',
    message: 'test message',
    timestamp: '2026-03-13 10:00:00.000',
    ...overrides,
  }
}

function makeFormatter(overrides: Partial<ConstructorParameters<typeof LogFormatter>[0]> = {}) {
  return new LogFormatter({
    consoleColors: false,
    consoleTimestamp: true,
    format: {
      enabled: false,
      timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
      includeStack: true,
      includeName: true,
      json: false,
      jsonIndent: 0,
    },
    ...overrides,
  })
}

// ─── formatMessage（文件格式）────────────────────────────────────────────────

describe('LogFormatter — formatMessage()', () => {
  it('默认格式含时间戳', () => {
    const f = makeFormatter()
    const out = f.formatMessage(makeEntry())
    expect(out).toContain('2026-03-13')
    expect(out).toContain('test message')
  })

  it('默认格式含大写级别', () => {
    const f = makeFormatter()
    const out = f.formatMessage(makeEntry({ level: 'warn' }))
    expect(out).toContain('WARN')
  })

  it('includeName:true 时含 name 字段', () => {
    const f = makeFormatter()
    const out = f.formatMessage(makeEntry({ name: 'myapp' }))
    expect(out).toContain('myapp')
  })

  it('includeStack:true 时含 file:line', () => {
    const f = makeFormatter()
    const out = f.formatMessage(makeEntry({ file: 'src/app.ts', line: 42 }))
    expect(out).toContain('src/app.ts:42')
  })

  it('data 字段被序列化输出', () => {
    const f = makeFormatter()
    const out = f.formatMessage(makeEntry({ data: { key: 'val' } }))
    expect(out).toContain('"key"')
    expect(out).toContain('"val"')
  })

  it('JSON 格式输出包含必要字段', () => {
    const f = makeFormatter({ format: { enabled: false, timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS', includeStack: true, includeName: true, json: true, jsonIndent: 0 } })
    const out = f.formatMessage(makeEntry({ name: 'app', data: { x: 1 } }))
    const parsed = JSON.parse(out)
    expect(parsed.level).toBe('info')
    expect(parsed.message).toBe('test message')
    expect(parsed.name).toBe('app')
    expect(parsed.data).toEqual({ x: 1 })
  })

  it('JSON 格式支持 jsonIndent 缩进', () => {
    const f = makeFormatter({ format: { enabled: false, timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS', includeStack: false, includeName: false, json: true, jsonIndent: 2 } })
    const out = f.formatMessage(makeEntry())
    expect(out).toContain('\n')
  })

  it('自定义 formatter 函数优先', () => {
    const f = makeFormatter({ format: { enabled: true, timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS', includeStack: false, includeName: false, json: false, jsonIndent: 0, formatter: (e) => `CUSTOM:${e.message}` } })
    const out = f.formatMessage(makeEntry())
    expect(out).toBe('CUSTOM:test message')
  })

  it('自定义 formatter 抛出时降级到默认格式', () => {
    jest.spyOn(console, 'error').mockImplementation(() => { })
    const f = makeFormatter({ format: { enabled: true, timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS', includeStack: false, includeName: false, json: false, jsonIndent: 0, formatter: () => { throw new Error('boom') } } })
    expect(() => f.formatMessage(makeEntry())).not.toThrow()
    jest.restoreAllMocks()
  })
})

// ─── formatConsoleMessage（控制台格式）───────────────────────────────────────

describe('LogFormatter — formatConsoleMessage()', () => {
  it('无色模式输出纯文本', () => {
    const f = makeFormatter({ consoleColors: false })
    const out = f.formatConsoleMessage(makeEntry())
    expect(out).toContain('test message')
    expect(out).toContain('INFO')
  })

  it('consoleTimestamp:false 时不含时间戳', () => {
    const f = makeFormatter({ consoleColors: false, consoleTimestamp: false })
    const out = f.formatConsoleMessage(makeEntry())
    expect(out).not.toContain('2026-03-13')
  })

  it('有色模式不抛出（chalk 已 mock）', () => {
    const f = makeFormatter({ consoleColors: true, consoleTimestamp: true })
    expect(() => f.formatConsoleMessage(makeEntry({ name: 'app', file: 'app.ts', line: 1 }))).not.toThrow()
  })

  it('自定义 formatter 在控制台模式优先', () => {
    const f = makeFormatter({ consoleColors: true, format: { enabled: true, timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS', includeStack: false, includeName: false, json: false, jsonIndent: 0, formatter: (e) => `CON:${e.message}` } })
    expect(f.formatConsoleMessage(makeEntry())).toBe('CON:test message')
  })
})

// ─── updateFormat ─────────────────────────────────────────────────────────────

describe('LogFormatter — updateFormat()', () => {
  it('可部分更新 includeStack', () => {
    const f = makeFormatter()
    f.updateFormat({ includeStack: false })
    expect(f.settings.format.includeStack).toBe(false)
  })

  it('可部分更新 json 模式', () => {
    const f = makeFormatter()
    f.updateFormat({ json: true, jsonIndent: 4 })
    expect(f.settings.format.json).toBe(true)
    expect(f.settings.format.jsonIndent).toBe(4)
  })

  it('可更新 timestampFormat', () => {
    const f = makeFormatter()
    f.updateFormat({ timestampFormat: 'HH:mm:ss' })
    expect(f.settings.format.timestampFormat).toBe('HH:mm:ss')
  })
})

// ─── safeStringify（通过 formatMessage 间接测试）──────────────────────────────

describe('LogFormatter — safeStringify 循环引用', () => {
  it('循环引用不抛出，输出含 [Circular]', () => {
    const f = makeFormatter()
    const obj: any = { a: 1 }
    obj.self = obj
    const out = f.formatMessage(makeEntry({ data: obj }))
    expect(out).toContain('Circular')
  })

  it('null 数据正常序列化', () => {
    const f = makeFormatter()
    const out = f.formatMessage(makeEntry({ data: null }))
    expect(out).toContain('null')
  })
})
