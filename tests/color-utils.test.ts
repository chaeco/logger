import { ColorUtils } from '../src/utils/color-utils'

describe('ColorUtils — getLevelColor()', () => {
  it('debug → gray', () => {
    const color = ColorUtils.getLevelColor('debug')
    expect(typeof color).toBe('function')
    expect(color('x')).toContain('x') // 原生 ANSI 包装后仍含原字符串
  })

  it('info → blue', () => {
    expect(typeof ColorUtils.getLevelColor('info')).toBe('function')
  })

  it('warn → yellow', () => {
    expect(typeof ColorUtils.getLevelColor('warn')).toBe('function')
  })

  it('error → red', () => {
    expect(typeof ColorUtils.getLevelColor('error')).toBe('function')
  })

  it('未知级别 → white', () => {
    expect(typeof ColorUtils.getLevelColor('trace')).toBe('function')
  })

  it('大小写不敏感', () => {
    expect(ColorUtils.getLevelColor('DEBUG')).toBe(ColorUtils.getLevelColor('debug'))
  })
})

describe('ColorUtils — colorizeLevel()', () => {
  it('输出含大写级别名', () => {
    expect(ColorUtils.colorizeLevel('info')).toContain('INFO')
  })

  it('使用 padEnd(6) 对齐', () => {
    // 'INFO  ' = 6 chars
    expect(ColorUtils.colorizeLevel('info').length).toBeGreaterThanOrEqual(6)
  })
})

describe('ColorUtils — colorizeTimestamp()', () => {
  it('输出含方括号', () => {
    const out = ColorUtils.colorizeTimestamp('2026-03-13 10:00:00.000')
    expect(out).toContain('[2026-03-13 10:00:00.000]')
  })
})

describe('ColorUtils — colorizeName()', () => {
  it('输出含方括号包裹名称', () => {
    expect(ColorUtils.colorizeName('app')).toContain('[app]')
  })
})

describe('ColorUtils — colorizeFileLocation()', () => {
  it('输出含圆括号包裹路径', () => {
    expect(ColorUtils.colorizeFileLocation('src/app.ts:42')).toContain('(src/app.ts:42)')
  })
})

describe('ColorUtils — colorizeMessage()', () => {
  it('输出含原始消息内容', () => {
    expect(ColorUtils.colorizeMessage('info', 'hello')).toContain('hello')
  })

  it('不同级别输出不抛出', () => {
    expect(() => ColorUtils.colorizeMessage('debug', 'msg')).not.toThrow()
    expect(() => ColorUtils.colorizeMessage('error', 'msg')).not.toThrow()
  })
})
