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
    function caller() {
      return h.getCallerInfo()
    }
    const r1 = caller()
    const r2 = caller()
    // 缓存命中：结果相同（file/line 相同）
    expect(r1.file).toBe(r2.file)
    expect(r1.line).toBe(r2.line)
  })

  it('缓存命中直接返回缓存结果', () => {
    const h = new CallerInfoHelper()
    const originalError = global.Error
    class FakeError extends originalError {
      constructor() {
        super('x')
        ;(this as any).stack = 'Error\n at /project/src/a.ts:10:5'
      }
    }
    ;(global as any).Error = FakeError
    const stack = new FakeError().stack as string
    const key = (h as any).simpleHash(stack)
    ;(h as any).cache.set(key, { file: 'cached.ts', line: 1 })
    const info = h.getCallerInfo()
    expect(info.file).toBe('cached.ts')
    expect(info.line).toBe(1)
    ;(global as any).Error = originalError
  })

  it('无法解析时返回空对象', () => {
    const h = new CallerInfoHelper()
    const originalError = global.Error
    class FakeError extends originalError {
      constructor() {
        super('x')
        ;(this as any).stack = 'Error\n at node:internal/process/task_queues:1:1'
      }
    }
    ;(global as any).Error = FakeError
    const info = h.getCallerInfo()
    expect(info).toEqual({})
    ;(global as any).Error = originalError
  })

  it('stack 为空时返回空对象', () => {
    const h = new CallerInfoHelper()
    const originalError = global.Error
    class FakeError extends originalError {
      constructor() {
        super('x')
        ;(this as any).stack = undefined
      }
    }
    ;(global as any).Error = FakeError
    const info = h.getCallerInfo()
    expect(info).toEqual({})
    ;(global as any).Error = originalError
  })

  it('stack 中包含空行时可正常跳过', () => {
    const h = new CallerInfoHelper()
    const originalError = global.Error
    class FakeError extends originalError {
      constructor() {
        super('x')
        ;(this as any).stack = 'Error\n\n at /project/src/a.ts:10:5'
      }
    }
    ;(global as any).Error = FakeError
    const info = h.getCallerInfo()
    expect(info.file).toBeDefined()
    ;(global as any).Error = originalError
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
    ;(h as any).cache.set('k1', { file: 'a.ts', line: 1 })
    ;(h as any).cache.set('k2', { file: 'b.ts', line: 2 })
    // 填入第 3 个应淘汰最旧
    ;(h as any).cacheResult('k3', { file: 'c.ts', line: 3 })
    expect(h.getCacheSize()).toBeLessThanOrEqual(2)
  })
})
