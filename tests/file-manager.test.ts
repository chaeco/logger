import * as fs from 'fs'
import { FileManager } from '../src/file/file-manager'

const TEST_DIR = './test-logs-fm'

function cleanup() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true })
}

beforeEach(cleanup)
afterEach(cleanup)

// ─── 构造与默认值 ─────────────────────────────────────────────────────────────

describe('FileManager — 构造', () => {
  it('使用默认选项构造不抛出', () => {
    expect(() => new FileManager({ path: TEST_DIR })).not.toThrow()
  })

  it('getOptions 返回合并后的完整配置（含默认值）', () => {
    const fm = new FileManager({ path: TEST_DIR, maxSize: 5000, filename: 'test' })
    const opts = fm.getOptions()
    expect(opts.path).toBe(TEST_DIR)
    expect(opts.maxSize).toBe(5000)
    expect(opts.filename).toBe('test')
    expect(opts.maxFiles).toBe(30)
    expect(opts.maxAge).toBe(30)
    expect(opts.compress).toBe(false)
    expect(opts.retryCount).toBe(3)
    expect(opts.retryDelay).toBe(100)
  })

  it('getAsyncOptions 无异步配置时返回 undefined', () => {
    const fm = new FileManager({ path: TEST_DIR })
    expect(fm.getAsyncOptions()).toBeUndefined()
  })

  it('getAsyncOptions 有异步配置时返回传入值', async () => {
    const fm = new FileManager({ path: TEST_DIR }, { enabled: true, batchSize: 50 })
    const ao = fm.getAsyncOptions()
    expect(ao?.enabled).toBe(true)
    expect(ao?.batchSize).toBe(50)
    await fm.close()
  })
})

// ─── init() ───────────────────────────────────────────────────────────────────

describe('FileManager — init()', () => {
  it('init 创建日志目录', () => {
    const fm = new FileManager({ path: TEST_DIR })
    fm.init()
    expect(fs.existsSync(TEST_DIR)).toBe(true)
  })

  it('重复调用 init 不抛出（幂等）', () => {
    const fm = new FileManager({ path: TEST_DIR })
    fm.init()
    expect(() => fm.init()).not.toThrow()
  })

  it('无效路径时 init 不抛出（静默处理）', () => {
    const fm = new FileManager({ path: '/root/no-perm-xyz-123' })
    expect(() => fm.init()).not.toThrow()
  })
})

// ─── write() ──────────────────────────────────────────────────────────────────

describe('FileManager — write()', () => {
  it('写入后日志文件存在', async () => {
    const fm = new FileManager({ path: TEST_DIR, filename: 'app' })
    await fm.write('hello')
    const files = fs.readdirSync(TEST_DIR)
    expect(files.some(f => f.endsWith('.log'))).toBe(true)
  })

  it('enabled:false 时不写文件', async () => {
    const fm = new FileManager({ enabled: false, path: TEST_DIR })
    await fm.write('should not write')
    expect(fs.existsSync(TEST_DIR)).toBe(false)
  })

  it('写入内容可读', async () => {
    const fm = new FileManager({ path: TEST_DIR, filename: 'app' })
    await fm.write('readable content')
    const files = fs.readdirSync(TEST_DIR)
    const content = fs.readFileSync(`${TEST_DIR}/${files[0]}`, 'utf8')
    expect(content).toContain('readable content')
  })

  it('init 失败后 write 静默忽略', async () => {
    const fm = new FileManager({ path: '/root/no-perm-xyz-123' })
    // 触发 init 失败
    fm.init()
    await expect(fm.write('hello')).resolves.not.toThrow()
  })
})

// ─── 文件轮转 ─────────────────────────────────────────────────────────────────

describe('FileManager — 文件轮转', () => {
  it('超过 maxSize 时创建新文件', async () => {
    const fm = new FileManager({ path: TEST_DIR, filename: 'rot', maxSize: 30 })
    // 写入足够多的内容触发轮转
    for (let i = 0; i < 10; i++) {
      await fm.write('0123456789abcdef') // 16 字节/条
    }
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    expect(files.length).toBeGreaterThan(1)
  })
})

// ─── 异步写入 ─────────────────────────────────────────────────────────────────

describe('FileManager — 异步写入', () => {
  it('异步模式写入后调用 close 可刷新到文件', async () => {
    const fm = new FileManager(
      { path: TEST_DIR, filename: 'async' },
      { enabled: true, batchSize: 100, flushInterval: 5000 },
    )
    await fm.write('async-msg')
    await fm.close()
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    expect(files.length).toBeGreaterThan(0)
    const content = fs.readFileSync(`${TEST_DIR}/${files[0]}`, 'utf8')
    expect(content).toContain('async-msg')
  })

  it('getQueueStatus 返回正确结构', async () => {
    const fm = new FileManager(
      { path: TEST_DIR },
      { enabled: true, batchSize: 100, flushInterval: 5000 },
    )
    const status = fm.getQueueStatus()
    expect(status).toHaveProperty('size')
    expect(status).toHaveProperty('isWriting')
    expect(typeof status.size).toBe('number')
    await fm.close()
  })

  it('无队列时 getQueueStatus.size 为 0', () => {
    const fm = new FileManager({ path: TEST_DIR })
    expect(fm.getQueueStatus().size).toBe(0)
  })
})

// ─── close() ─────────────────────────────────────────────────────────────────

describe('FileManager — close()', () => {
  it('无异步队列时 close 正常完成', async () => {
    const fm = new FileManager({ path: TEST_DIR })
    await expect(fm.close()).resolves.not.toThrow()
  })
})
