import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { NodeWriter } from '../src/file/node-writer'

const TEST_DIR = './test-logs-nw'

function makeOptions(
  overrides: Partial<{
    path: string
    filename: string
    maxSize: number
    maxFiles: number
    maxAge: number
    compress: boolean
    retryCount: number
    retryDelay: number
    enabled: boolean
  }> = {}
) {
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

function getRecentPastDate(): string {
  const date = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function getTodayDate(): string {
  const date = new Date()
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

async function waitFor(condition: () => boolean, timeoutMs = 2000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    if (condition()) return
    await new Promise((resolve) => setTimeout(resolve, 20))
  }
  throw new Error('Timed out waiting for condition')
}

beforeEach(cleanup)
afterEach(cleanup)

type NodeWriterInternals = {
  currentFilePath: string
  pruneFilesByCount(): void
}

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
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const w = new NodeWriter(makeOptions({ path: '/root/no-perm-xyz-nw' }))
    w.init()
    expect(w.initError).toBeDefined()
    warn.mockRestore()
  })

  it('重复调用 init 不抛出', () => {
    const w = new NodeWriter(makeOptions())
    w.init()
    expect(() => w.init()).not.toThrow()
  })

  it('initializeCurrentFile 异常时 initError 被设置', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    jest.isolateModules(() => {
      jest.doMock('fs', () => {
        const real = jest.requireActual('fs')
        return {
          ...real,
          existsSync: () => true,
          statSync: () => {
            throw new Error('stat fail')
          },
        }
      })
      const { NodeWriter: MockedNodeWriter } = require('../src/file/node-writer')
      const w = new MockedNodeWriter(makeOptions({ filename: 'err' }))
      w.init()
      expect(w.initError).toBeDefined()
    })
    jest.resetModules()
    warn.mockRestore()
  })

  it('已有文件且超过 maxSize 时初始化会切换到新分片', () => {
    const opts = makeOptions({ filename: 'rotate-init', maxSize: 1 })
    const w = new NodeWriter(opts)
    const today = getTodayDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `rotate-init-${today}.log`), 'xx')
    w.init()
    const current = (w as any).currentFilePath as string
    expect(current.endsWith(`rotate-init-${today}.1.log`)).toBe(true)
  })
})

// ─── write() ──────────────────────────────────────────────────────────────────

describe('NodeWriter — write()', () => {
  it('写入单条消息后文件存在', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'single' }))
    w.init()
    await w.write('hello world')
    const files = fs.readdirSync(TEST_DIR)
    expect(files.some((f) => f.endsWith('.log'))).toBe(true)
  })

  it('写入内容含换行符', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'nl' }))
    w.init()
    await w.write('line one')
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    const content = fs.readFileSync(path.join(TEST_DIR, files[0]), 'utf8')
    expect(content).toMatch(/line one\n/)
  })

  it('多次写入内容均追加到文件', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'multi' }))
    w.init()
    await w.write('first')
    await w.write('second')
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
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
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    const content = fs.readFileSync(path.join(TEST_DIR, files[0]), 'utf8')
    expect(content).toContain('alpha')
    expect(content).toContain('beta')
    expect(content).toContain('gamma')
  })

  it('writeBatch 在超过 maxSize 时触发轮转', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'batchrot', maxSize: 1 }))
    w.init()
    ;(w as any).currentFileSize = 2
    await w.writeBatch(['x'])
    const current = (w as any).currentFilePath as string
    expect(current.includes('.1.log')).toBe(true)
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
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    expect(files.length).toBeGreaterThan(1)
  })

  it('maxFiles 超出时删除最旧文件', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'mf', maxSize: 20, maxFiles: 2 }))
    w.init()
    for (let i = 0; i < 20; i++) {
      await w.write('123456789012345678') // 每条 > 20B，触发多次轮转
    }
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    expect(files.length).toBeLessThanOrEqual(3) // maxFiles + 当前文件
  })

  it('日期切换时会重新初始化当前文件', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'date' }))
    w.init()
    const yesterday = getRecentPastDate()
    const internals = w as unknown as { currentFilePath: string }
    internals.currentFilePath = path.join(TEST_DIR, `date-${yesterday}.log`)
    fs.writeFileSync(internals.currentFilePath, 'old\n')

    await w.write('today')

    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    const today = getTodayDate()
    expect(files.some((f) => f.includes(`date-${today}`))).toBe(true)
  })
})

// ─── 压缩与清理 ─────────────────────────────────────────────────────────────

describe('NodeWriter — 压缩与清理', () => {
  it('压缩发生在 maxFiles 清理之前，确保同日分片不会被提前删掉', async () => {
    const date = getRecentPastDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `cmp-${date}.log`), 'alpha')
    fs.writeFileSync(path.join(TEST_DIR, `cmp-${date}.1.log`), 'beta')
    fs.writeFileSync(path.join(TEST_DIR, `cmp-${date}.2.log`), 'gamma')

    const w = new NodeWriter(makeOptions({ filename: 'cmp', compress: true, maxFiles: 1 }))
    w.init()

    await waitFor(() => fs.existsSync(path.join(TEST_DIR, `cmp-${date}.log.gz`)))
    // 等待压缩完成后删除原始分片（压缩在 async promise 链中异步执行）
    await waitFor(() => !fs.existsSync(path.join(TEST_DIR, `cmp-${date}.log`)))
    await waitFor(() => !fs.existsSync(path.join(TEST_DIR, `cmp-${date}.2.log`)))

    const gz = fs.readFileSync(path.join(TEST_DIR, `cmp-${date}.log.gz`))
    const content = zlib.gunzipSync(gz).toString('utf8')

    expect(content).toBe('alpha\nbeta\ngamma')
    expect(fs.existsSync(path.join(TEST_DIR, `cmp-${date}.log`))).toBe(false)
    expect(fs.existsSync(path.join(TEST_DIR, `cmp-${date}.1.log`))).toBe(false)
    expect(fs.existsSync(path.join(TEST_DIR, `cmp-${date}.2.log`))).toBe(false)
  })

  it('已有 .log.gz 时会保留原归档内容并追加新分片', async () => {
    const date = getRecentPastDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(TEST_DIR, `merge-${date}.log.gz`),
      zlib.gzipSync(Buffer.from('first\n'))
    )
    fs.writeFileSync(path.join(TEST_DIR, `merge-${date}.1.log`), 'second\n')

    const w = new NodeWriter(makeOptions({ filename: 'merge', compress: true, maxFiles: 10 }))
    w.init()

    await waitFor(() => !fs.existsSync(path.join(TEST_DIR, `merge-${date}.1.log`)))

    const gz = fs.readFileSync(path.join(TEST_DIR, `merge-${date}.log.gz`))
    const content = zlib.gunzipSync(gz).toString('utf8')

    expect(content).toBe('first\nsecond\n')
  })

  it('空分片不会导致额外空行', async () => {
    const date = getRecentPastDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `empty-${date}.log`), 'alpha')
    fs.writeFileSync(path.join(TEST_DIR, `empty-${date}.1.log`), '')
    fs.writeFileSync(path.join(TEST_DIR, `empty-${date}.2.log`), 'beta\n')

    const w = new NodeWriter(makeOptions({ filename: 'empty', compress: true, maxFiles: 10 }))
    w.init()

    await waitFor(() => fs.existsSync(path.join(TEST_DIR, `empty-${date}.log.gz`)))

    const gz = fs.readFileSync(path.join(TEST_DIR, `empty-${date}.log.gz`))
    const content = zlib.gunzipSync(gz).toString('utf8')

    expect(content).toBe('alpha\nbeta\n')
  })

  it('maxFiles 裁剪同日分片时保留当前活跃文件和最新分片', () => {
    const date = getTodayDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `keep-${date}.log`), 'base\n')
    fs.writeFileSync(path.join(TEST_DIR, `keep-${date}.1.log`), 'older\n')
    fs.writeFileSync(path.join(TEST_DIR, `keep-${date}.2.log`), 'current\n')

    const w = new NodeWriter(makeOptions({ filename: 'keep', maxFiles: 2 }))
    w.init()
    const internals = w as unknown as NodeWriterInternals
    internals.currentFilePath = path.join(TEST_DIR, `keep-${date}.2.log`)
    internals.pruneFilesByCount()

    expect(fs.existsSync(path.join(TEST_DIR, `keep-${date}.2.log`))).toBe(true)
    expect(fs.existsSync(path.join(TEST_DIR, `keep-${date}.1.log`))).toBe(true)
    expect(fs.existsSync(path.join(TEST_DIR, `keep-${date}.log`))).toBe(false)
  })

  it('maxAge=0 时会删除过期文件', () => {
    const date = getRecentPastDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `age-${date}.log`), 'old\n')

    const w = new NodeWriter(makeOptions({ filename: 'age', maxAge: 0 }))
    w.init()

    expect(fs.existsSync(path.join(TEST_DIR, `age-${date}.log`))).toBe(false)
  })

  it('compressOldLogs 会跳过今天的文件', async () => {
    const date = getTodayDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `today-${date}.log`), 't')
    const w = new NodeWriter(makeOptions({ filename: 'today', compress: true }))
    await (w as any).compressOldLogs()
    expect(fs.existsSync(path.join(TEST_DIR, `today-${date}.log.gz`))).toBe(false)
  })

  it('streamCompressDayFiles 支持已有归档并补齐换行', async () => {
    fs.mkdirSync(TEST_DIR, { recursive: true })
    const oldGz = path.join(TEST_DIR, 'sc.gz')
    fs.writeFileSync(oldGz, zlib.gzipSync(Buffer.from('first')))
    const f1 = path.join(TEST_DIR, 'd1.log')
    const f2 = path.join(TEST_DIR, 'd2.log')
    fs.writeFileSync(f1, 'second')
    fs.writeFileSync(f2, 'third')
    const out = path.join(TEST_DIR, 'out.gz')
    const w = new NodeWriter(makeOptions({ filename: 'sc' }))
    await (w as any).streamCompressDayFiles(
      [
        { name: 'd1.log', path: f1 },
        { name: 'd2.log', path: f2 },
      ],
      out,
      oldGz
    )
    const content = zlib.gunzipSync(fs.readFileSync(out)).toString('utf8')
    expect(content).toBe('first\nsecond\nthird')
  })

  it('压缩时按分片索引升序合并', async () => {
    const date = getRecentPastDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(path.join(TEST_DIR, `ord-${date}.log`), 'a')
    fs.writeFileSync(path.join(TEST_DIR, `ord-${date}.10.log`), 'c')
    fs.writeFileSync(path.join(TEST_DIR, `ord-${date}.2.log`), 'b')
    const w = new NodeWriter(makeOptions({ filename: 'ord', compress: true, maxFiles: 10 }))
    await (w as any).compressOldLogs()
    const gz = fs.readFileSync(path.join(TEST_DIR, `ord-${date}.log.gz`))
    const content = zlib.gunzipSync(gz).toString('utf8')
    expect(content).toBe('a\nb\nc')
  })

  it('压缩失败时会尝试恢复原有归档文件', async () => {
    const date = getRecentPastDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    fs.writeFileSync(
      path.join(TEST_DIR, `recover-${date}.log.gz`),
      zlib.gzipSync(Buffer.from('old\n'))
    )
    fs.writeFileSync(path.join(TEST_DIR, `recover-${date}.1.log`), 'new\n')

    const spy = jest
      .spyOn(NodeWriter.prototype as any, 'streamCompressDayFiles')
      .mockRejectedValue(new Error('boom'))

    const w = new NodeWriter(makeOptions({ filename: 'recover', compress: true, maxFiles: 10 }))
    await (w as any).compressOldLogs()

    const gz = path.join(TEST_DIR, `recover-${date}.log.gz`)
    const bak = `${gz}.bak`
    expect(fs.existsSync(bak)).toBe(false)
    spy.mockRestore()
  })

  it('compressionPending 阻止并发压缩', () => {
    const w = new NodeWriter(makeOptions({ filename: 'no-concurrent', compress: true }))
    ;(w as any).compressionPending = true
    // cleanupOldFiles 应跳过压缩，直接执行数量清理
    const compressSpy = jest.spyOn(w as any, 'compressOldLogs').mockResolvedValue(undefined)
    ;(w as any).cleanupOldFiles()
    expect(compressSpy).not.toHaveBeenCalled()
    compressSpy.mockRestore()
  })
})

// ─── 目录穿越防护 ─────────────────────────────────────────────────────────────

describe('NodeWriter — 安全防护', () => {
  it('filename 中的路径分隔符被替换为下划线', async () => {
    const w = new NodeWriter(makeOptions({ filename: '../../etc/passwd' }))
    w.init()
    await w.write('safe')
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    // 替换后斜杠消失，不存在路径分隔符，文件仍在 TEST_DIR 内（无目录穿越）
    expect(files.every((f) => !f.includes('/') && !f.includes('\\'))).toBe(true)
    expect(files.some((f) => f.includes('_'))).toBe(true)
  })
})

describe('NodeWriter — 排序与写入失败', () => {
  it('listManagedFiles 在 mtime 不同的情况下执行 mtime 排序分支', () => {
    const date = getTodayDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    const f1 = path.join(TEST_DIR, `sort-${date}.log`)
    const f2 = path.join(TEST_DIR, `sort-${date}.0.log`)
    fs.writeFileSync(f1, 'a')
    fs.writeFileSync(f2, 'b')
    const t1 = new Date('2026-03-23T00:00:00Z')
    const t2 = new Date('2026-03-23T00:00:01Z')
    fs.utimesSync(f1, t1, t1)
    fs.utimesSync(f2, t2, t2)
    const w = new NodeWriter(makeOptions({ filename: 'sort' }))
    ;(w as any).currentFilePath = path.join(TEST_DIR, 'none')
    const list = (w as any).listManagedFiles()
    expect(list.length).toBe(2)
  })

  it('listManagedFiles 在 mtime 相同时执行 name 排序分支', () => {
    const date = getTodayDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    const f1 = path.join(TEST_DIR, `sort2-${date}.log`)
    const f2 = path.join(TEST_DIR, `sort2-${date}.0.log`)
    fs.writeFileSync(f1, 'a')
    fs.writeFileSync(f2, 'b')
    const t = new Date('2026-03-23T00:00:00Z')
    fs.utimesSync(f1, t, t)
    fs.utimesSync(f2, t, t)
    const w = new NodeWriter(makeOptions({ filename: 'sort2' }))
    ;(w as any).currentFilePath = path.join(TEST_DIR, 'none')
    const list = (w as any).listManagedFiles()
    expect(list.length).toBe(2)
  })

  it('listManagedFiles 在 sortKey 不同时按日期排序', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true })
    const d1 = getRecentPastDate()
    const d2 = getTodayDate()
    fs.writeFileSync(path.join(TEST_DIR, `sd-${d1}.log`), 'a')
    fs.writeFileSync(path.join(TEST_DIR, `sd-${d2}.log`), 'b')
    const w = new NodeWriter(makeOptions({ filename: 'sd' }))
    const list = (w as any).listManagedFiles()
    expect(list[0].name).toContain(d2)
  })

  it('appendToFileWithRetry 多次失败后抛错', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {})
    const w = new NodeWriter(
      makeOptions({ filename: 'fail', retryCount: 0, path: '/root/no-perm-xyz-nw' })
    )
    w.init()
    const err = jest.spyOn(console, 'error').mockImplementation(() => {})
    await expect((w as any).appendToFileWithRetry('x')).rejects.toThrow()
    err.mockRestore()
    warn.mockRestore()
  })

  it('appendToFileWithRetry 第一次失败后会重试并成功', async () => {
    const w = new NodeWriter(makeOptions({ filename: 'retry', retryCount: 1, retryDelay: 1 }))
    w.init()
    ;(w as any).currentFilePath = TEST_DIR
    await (w as any).appendToFileWithRetry('ok')
    const files = fs.readdirSync(TEST_DIR).filter((f) => f.endsWith('.log'))
    expect(files.length).toBeGreaterThan(0)
  })

  it('listManagedFiles 返回包含 fileDate 与 sortKey', () => {
    const date = getTodayDate()
    fs.mkdirSync(TEST_DIR, { recursive: true })
    const f1 = path.join(TEST_DIR, `lm-${date}.log`)
    const f2 = path.join(TEST_DIR, `lm-${date}.1.log`)
    fs.writeFileSync(f1, 'a')
    fs.writeFileSync(f2, 'b')
    const w = new NodeWriter(makeOptions({ filename: 'lm' }))
    const list = (w as any).listManagedFiles()
    expect(list[0]).toHaveProperty('fileDate')
    expect(list[0]).toHaveProperty('sortKey')
  })

  it('无日期文件使用 mtime 作为 sortKey 且可被过期清理', () => {
    fs.mkdirSync(TEST_DIR, { recursive: true })
    const f = path.join(TEST_DIR, 'nodate.log')
    fs.writeFileSync(f, 'x')
    const w = new NodeWriter(makeOptions({ filename: 'nodate', maxAge: 0 }))
    const past = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    fs.utimesSync(f, past, past)
    const list = (w as any).listManagedFiles()
    expect(list[0].fileDate).toBeNull()
    ;(w as any).pruneExpiredFiles()
    expect(fs.existsSync(f)).toBe(false)
  })

  it('checkDateRotation 在无日期路径时触发重置', () => {
    const w = new NodeWriter(makeOptions({ filename: 'chk' }))
    ;(w as any).currentFilePath = 'nodate.log'
    const initSpy = jest.spyOn(w as any, 'initializeCurrentFile').mockImplementation(() => {})
    const cleanSpy = jest.spyOn(w as any, 'cleanupOldFiles').mockImplementation(() => {})
    ;(w as any).checkDateRotation()
    expect(initSpy).toHaveBeenCalled()
    expect(cleanSpy).toHaveBeenCalled()
    initSpy.mockRestore()
    cleanSpy.mockRestore()
  })

  it('getShardIndex 解析分片索引', () => {
    const w = new NodeWriter(makeOptions({ filename: 'si' }))
    // 主文件（无索引）返回 0
    expect((w as any).getShardIndex('app-2026-01-01.log')).toBe(0)
    // 分片文件返回索引
    expect((w as any).getShardIndex('app-2026-01-01.3.log')).toBe(3)
    // .gz 文件返回 MAX_SAFE_INTEGER
    expect((w as any).getShardIndex('app-2026-01-01.log.gz')).toBe(Number.MAX_SAFE_INTEGER)
  })

  it('getIndexedFilePath 生成正确路径', () => {
    const w = new NodeWriter(makeOptions({ filename: 'idx', path: '/logs' }))
    ;(w as any).fileIndex = 0
    const p0 = (w as any).getIndexedFilePath()
    expect(p0).toMatch(/\/logs\/idx-\d{4}-\d{2}-\d{2}\.log$/)
    ;(w as any).fileIndex = 1
    const p1 = (w as any).getIndexedFilePath()
    expect(p1).toMatch(/\/logs\/idx-\d{4}-\d{2}-\d{2}\.1\.log$/)
  })
})
