import * as fs from 'fs'
import * as path from 'path'
import { NodeWriter } from '../src/file/node-writer'

const TEST_DIR = './test-logs-nw'

function makeOptions(overrides: Partial<{
  path: string; filename: string; maxSize: number; maxFiles: number
  maxAge: number; compress: boolean; retryCount: number; retryDelay: number
  enabled: boolean
}> = {}) {
  return {
    enabled: true,
    path: TEST_DIR,
    filename: 'app',
    maxSize: 10 * 1024 * 1024,
    maxFiles: 30,
    maxAge: 30,
    compress: false,
    retryCount: 3,
    retryDelay: 100,
    ...overrides,
  }
}

function cleanup() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true })
}

beforeEach(cleanup)
afterEach(cleanup)

// ─── init() ───────────────────────────────────────────────────────────────────

describe('NodeWriter — init()', () => {
  it('init 创建日志目录', () => {
    const w = new NodeWriter(makeOptions())
    w.init()
    expect(fs.existsSync(TEST_DIR)).toBe(true)
  })

  it('init 后 initError 为 undefined（正常情况）', () => {
    const w = new NodeWriter(makeOptions())
    w.init()
    expect(w.initError).toBeUndefined()
  })

  it('目录不可写时 initError 不为 undefined', () => {
    const w = new NodeWriter(makeOptions({ path: '/root/no-perm-xyz-nw' }))
    w.init()
    expect(w.initError).toBeDefined()
  })

  it('重复调用 init 不抛出', () => {
    const w = new NodeWriter(makeOptions())
    w.init()
    expect(() => w.init()).not.toThrow()
  })
})

// ─── write() ──────────────────────────────────────────────────────────────────

describe('NodeWriter — write()', () => {
  it('写入单条消息后文件存在', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'single' }))
    w.init()
    await w.write('hello world')
    const files = fs.readdirSync(TEST_DIR)
    expect(files.some(f => f.endsWith('.log'))).toBe(true)
  })

  it('写入内容含换行符', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'nl' }))
    w.init()
    await w.write('line one')
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    const content = fs.readFileSync(path.join(TEST_DIR, files[0]), 'utf8')
    expect(content).toMatch(/line one\n/)
  })

  it('多次写入内容均追加到文件', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'multi' }))
    w.init()
    await w.write('first')
    await w.write('second')
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    const content = fs.readFileSync(path.join(TEST_DIR, files[0]), 'utf8')
    expect(content).toContain('first')
    expect(content).toContain('second')
  })
})

// ─── writeBatch() ─────────────────────────────────────────────────────────────

describe('NodeWriter — writeBatch()', () => {
  it('批量写入所有消息到文件', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'batch' }))
    w.init()
    await w.writeBatch(['alpha', 'beta', 'gamma'])
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    const content = fs.readFileSync(path.join(TEST_DIR, files[0]), 'utf8')
    expect(content).toContain('alpha')
    expect(content).toContain('beta')
    expect(content).toContain('gamma')
  })
})

// ─── 文件轮转 ─────────────────────────────────────────────────────────────────

describe('NodeWriter — 文件轮转', () => {
  it('超过 maxSize 时创建新文件（文件名带索引）', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'rot', maxSize: 50 }))
    w.init()
    for (let i = 0; i < 8; i++) {
      await w.write('0123456789abcdef') // > maxSize 触发轮转
    }
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    expect(files.length).toBeGreaterThan(1)
  })

  it('maxFiles 超出时删除最旧文件', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'mf', maxSize: 20, maxFiles: 2 }))
    w.init()
    for (let i = 0; i < 20; i++) {
      await w.write('123456789012345678') // 每条 > 20B，触发多次轮转
    }
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    expect(files.length).toBeLessThanOrEqual(3) // maxFiles + 当前文件
  })
})

// ─── 目录穿越防护 ─────────────────────────────────────────────────────────────

describe('NodeWriter — 安全防护', () => {
  it('filename 中的路径分隔符被替换为下划线', async () => {
    const w = new NodeWriter(makeOptions({ filename: '../../etc/passwd' }))
    w.init()
    await w.write('safe')
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    // 替换后斜杠消失，不存在路径分隔符，文件仍在 TEST_DIR 内（无目录穿越）
    expect(files.every(f => !f.includes('/') && !f.includes('\\'))).toBe(true)
    expect(files.some(f => f.includes('_'))).toBe(true)
  })
})
