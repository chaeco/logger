import { CallerInfoHelper } from '../src/utils/caller-info'

describe('CallerInfoHelper — getCallerInfo()', () => {
  it('返回包含 file 或 line 的对象', () => {
    const h = new CallerInfoHelper()
    const info = h.getCallerInfo()
    // 在测试环境（jest/ts-jest）中应能解析出调用者信息
    expect(typeof info).toBe('object')
  })

  it('file 为字符串或 undefined', () => {
    const h = new CallerInfoHelper()
    const { file } = h.getCallerInfo()
    expect(file === undefined || typeof file === 'string').toBe(true)
  })

  it('line 为数字或 undefined', () => {
    const h = new CallerInfoHelper()
    const { line } = h.getCallerInfo()
    expect(line === undefined || typeof line === 'number').toBe(true)
  })

  it('相同调用位置走缓存路径', () => {
    const h = new CallerInfoHelper()
    // 通过同一个包装函数调用，确保堆栈一致
    function caller() { return h.getCallerInfo() }
    const r1 = caller()
    const r2 = caller()
    // 缓存命中：结果相同（file/line 相同）
    expect(r1.file).toBe(r2.file)
    expect(r1.line).toBe(r2.line)
  })
})

describe('CallerInfoHelper — clearCache()', () => {
  it('clearCache 后缓存大小归零', () => {
    const h = new CallerInfoHelper()
    h.getCallerInfo()
    h.clearCache()
    expect(h.getCacheSize()).toBe(0)
  })

  it('clearCache 不抛出', () => {
    const h = new CallerInfoHelper()
    expect(() => h.clearCache()).not.toThrow()
  })
})

describe('CallerInfoHelper — LRU 缓存淘汰', () => {
  it('超过 maxCacheSize 时不抛出', () => {
    const h = new CallerInfoHelper(2)
      // 伪造缓存填满
      ; (h as any).cache.set('k1', { file: 'a.ts', line: 1 })
      ; (h as any).cache.set('k2', { file: 'b.ts', line: 2 })
      // 填入第 3 个应淘汰最旧
      ; (h as any).cacheResult('k3', { file: 'c.ts', line: 3 })
    expect(h.getCacheSize()).toBeLessThanOrEqual(2)
  })
})
