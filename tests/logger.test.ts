import * as fs from 'fs'
import { Logger } from '../src/core/logger'
import { CallerInfoHelper } from '../src/utils/caller-info'

const TEST_DIR = './test-logs-logger'
const TEST_DIR_2 = './test-logs-logger-2'

function cleanup() {
  if (fs.existsSync(TEST_DIR)) fs.rmSync(TEST_DIR, { recursive: true, force: true })
  if (fs.existsSync(TEST_DIR_2)) fs.rmSync(TEST_DIR_2, { recursive: true, force: true })
}

beforeEach(cleanup)
afterEach(cleanup)

type LoggerWithFileManager = {
  fileManager?: unknown
}

describe('Logger — child()', () => {
  it('子 logger 与父 logger 共享同一个 FileManager', async () => {
    const logger = new Logger({
      name: 'app',
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })

    const child = logger.child('db')
    const parentWithFileManager = logger as unknown as LoggerWithFileManager
    const childWithFileManager = child as unknown as LoggerWithFileManager

    expect(childWithFileManager.fileManager).toBe(parentWithFileManager.fileManager)

    await child.close()
    await logger.info('parent write still works after child.close')

    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    expect(files.length).toBe(1)
    const content = fs.readFileSync(`${TEST_DIR}/${files[0]}`, 'utf8')
    expect(content).toContain('parent write still works after child.close')

    await logger.close()
  })
})

describe('Logger — init()', () => {
  it('调用 init 会初始化 FileManager', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })
    const fm = (logger as any).fileManager
    const spy = jest.spyOn(fm, 'init')
    logger.init()
    expect(spy).toHaveBeenCalled()
  })
})

describe('Logger — 默认配置', () => {
  it('默认启用控制台输出', () => {
    const logger = new Logger()
    expect((logger as any).consoleEnabled).toBe(true)
  })
})

describe('Logger — 配置与事件', () => {
  it('setLevel 触发 levelChange 事件', () => {
    const logger = new Logger({ console: { enabled: false }, file: { enabled: false } })
    const events: any[] = []
    logger.on('levelChange', e => events.push(e))
    logger.setLevel('debug')
    expect(events.length).toBe(1)
    expect(events[0].data.oldLevel).toBe('info')
    expect(events[0].data.newLevel).toBe('debug')
  })

  it('getLevel 返回当前等级', () => {
    const logger = new Logger({ level: 'warn', console: { enabled: false }, file: { enabled: false } })
    expect(logger.getLevel()).toBe('warn')
  })

  it('off 移除事件处理器后不再触发', () => {
    const logger = new Logger({ console: { enabled: false }, file: { enabled: false } })
    const handler = jest.fn()
    logger.on('levelChange', handler)
    logger.off('levelChange', handler)
    logger.setLevel('warn')
    expect(handler).not.toHaveBeenCalled()
  })

  it('configureFormat / configureErrorHandling 生效', () => {
    const logger = new Logger({ console: { enabled: false }, file: { enabled: false } })
    const onError = jest.fn()
    logger.configureFormat({ json: true })
    logger.configureErrorHandling({ silent: false, fallbackToConsole: false, onError })
    expect((logger as any).formatter.settings.format.json).toBe(true)
    expect((logger as any).errorHandling.silent).toBe(false)
    expect((logger as any).errorHandling.fallbackToConsole).toBe(false)
    expect((logger as any).errorHandling.onError).toBe(onError)
  })

  it('updateConfig 可更新控制台配置', () => {
    const logger = new Logger({ console: { enabled: true, colors: true, timestamp: true }, file: { enabled: false } })
    logger.updateConfig({ console: { enabled: false, colors: false, timestamp: false } })
    expect((logger as any).consoleEnabled).toBe(false)
    expect((logger as any).formatter.settings.consoleColors).toBe(false)
    expect((logger as any).formatter.settings.consoleTimestamp).toBe(false)
  })

  it('updateConfig 可在无 fileManager 时启用文件输出', () => {
    const logger = new Logger({ file: { enabled: false }, console: { enabled: false } })
    expect((logger as any).fileManager).toBeUndefined()
    logger.updateConfig({ file: { enabled: true, path: TEST_DIR, filename: 'app' } })
    expect((logger as any).fileManager).toBeDefined()
  })

  it('updateConfig 可更新等级/格式/错误处理', () => {
    const logger = new Logger({ console: { enabled: false }, file: { enabled: false } })
    logger.updateConfig({ level: 'error', format: { json: true }, errorHandling: { silent: false } })
    expect(logger.getLevel()).toBe('error')
    expect((logger as any).formatter.settings.format.json).toBe(true)
    expect((logger as any).errorHandling.silent).toBe(false)
  })

  it('updateConfig 支持空对象覆盖分支', () => {
    const logger = new Logger({ console: { enabled: true }, file: { enabled: true, path: TEST_DIR, filename: 'x' } })
    logger.updateConfig({ console: {}, file: {} as any })
    expect((logger as any).fileEnabled).toBe(true)
  })

  it('off 在不存在 handler 时直接返回', () => {
    const logger = new Logger({ console: { enabled: false }, file: { enabled: false } })
    expect(() => logger.off('levelChange', () => { })).not.toThrow()
  })
})

describe('Logger — child() 无文件输出', () => {
  it('file 未启用时 child 也禁用文件输出', () => {
    const logger = new Logger({ file: { enabled: false }, console: { enabled: false } })
    const child = logger.child('x')
    expect((child as any).fileManager).toBeUndefined()
    expect((child as any).fileEnabled).toBe(false)
  })
})

describe('Logger — updateConfig()', () => {
  it('可在运行时禁用文件输出', async () => {
    const logger = new Logger({
      name: 'app',
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })

    logger.info('first')
    const files1 = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    const content1 = fs.readFileSync(`${TEST_DIR}/${files1[0]}`, 'utf8')
    expect(content1).toContain('first')

    logger.updateConfig({ file: { enabled: false } })
    logger.info('second')

    const content2 = fs.readFileSync(`${TEST_DIR}/${files1[0]}`, 'utf8')
    expect(content2).not.toContain('second')

    await logger.close()
  })

  it('文件配置变更后会重建 FileManager 并生效', async () => {
    const logger = new Logger({
      name: 'app',
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })

    logger.info('before-change')
    const files1 = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    expect(files1.length).toBe(1)

    logger.updateConfig({ file: { enabled: true, path: TEST_DIR_2, filename: 'app2' } })
    logger.info('after-change')

    const files2 = fs.readdirSync(TEST_DIR_2).filter(f => f.endsWith('.log'))
    expect(files2.length).toBe(1)
    const content2 = fs.readFileSync(`${TEST_DIR_2}/${files2[0]}`, 'utf8')
    expect(content2).toContain('after-change')

    await logger.close()
  })
})

describe('Logger — includeStack 开关', () => {
  it('includeStack=false 时不解析调用栈', async () => {
    const spy = jest.spyOn(CallerInfoHelper.prototype, 'getCallerInfo')
    const logger = new Logger({
      console: { enabled: false },
      file: { enabled: false },
      format: { includeStack: false },
    })
    logger.info('no stack')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    await logger.close()
  })
})

describe('Logger — error event', () => {
  it('文件写入失败时触发 error 事件', async () => {
    const logger = new Logger({
      name: 'app',
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })
    const fm = (logger as any).fileManager
    jest.spyOn(fm, 'write').mockRejectedValue(new Error('write fail'))

    const events: any[] = []
    logger.on('error', (e) => events.push(e))

    logger.info('should fail')
    await new Promise(r => setTimeout(r, 0))

    expect(events.length).toBe(1)
    expect(events[0].data?.context).toBe('file_write')

    await logger.close()
  })
})

describe('Logger — shared FileManager', () => {
  it('传入 sharedFileManager 时不拥有资源', () => {
    const shared = new Logger({ file: { enabled: true, path: TEST_DIR, filename: 's' }, console: { enabled: false } })
    const fm = (shared as any).fileManager
    const logger = new Logger({ console: { enabled: false } }, fm)
    expect((logger as any).ownsFileManager).toBe(false)
    expect((logger as any).fileManager).toBe(fm)
  })
})

describe('Logger — close()', () => {
  it('close 中 fileManager.close 抛错时吞掉异常并记录', async () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })
    const fm = (logger as any).fileManager
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { })
    jest.spyOn(fm, 'close').mockRejectedValue(new Error('close fail'))
    await logger.close()
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('Logger — emitEvent handler 异常', () => {
  it('事件处理器抛错时不影响其他逻辑', () => {
    const logger = new Logger({ console: { enabled: false }, file: { enabled: false } })
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { })
    logger.on('levelChange', () => { throw new Error('handler fail') })
    logger.setLevel('warn')
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('Logger — level 与 shouldLog', () => {
  it('低于当前等级的日志不写入文件', async () => {
    const logger = new Logger({
      level: 'warn',
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
    })
    logger.info('ignored')
    logger.warn('kept')
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    const content = fs.readFileSync(`${TEST_DIR}/${files[0]}`, 'utf8')
    expect(content).not.toContain('ignored')
    expect(content).toContain('kept')
    await logger.close()
  })
})

describe('Logger — console 输出', () => {
  it('consoleEnabled=false 时不调用 console.log', async () => {
    const spy = jest.spyOn(console, 'log').mockImplementation(() => { })
    const logger = new Logger({
      console: { enabled: false },
      file: { enabled: false },
    })
    logger.info('no console')
    expect(spy).not.toHaveBeenCalled()
    spy.mockRestore()
    await logger.close()
  })
})

describe('Logger — JSON 格式输出', () => {
  it('format.json=true 时文件输出为 JSON', async () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'json' },
      console: { enabled: false },
      format: { json: true, jsonIndent: 0, includeStack: false },
    })
    logger.info('json-msg', { a: 1 })
    const files = fs.readdirSync(TEST_DIR).filter(f => f.endsWith('.log'))
    const content = fs.readFileSync(`${TEST_DIR}/${files[0]}`, 'utf8').trim()
    const parsed = JSON.parse(content)
    expect(parsed.message).toBe('json-msg')
    expect(parsed.data).toEqual({ a: 1 })
    await logger.close()
  })
})

describe('Logger — errorHandling fallback', () => {
  it('写入失败且 silent=false 时输出 fallback 到 console.error', async () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'app' },
      console: { enabled: false },
      errorHandling: { silent: false, fallbackToConsole: true },
    })
    const fm = (logger as any).fileManager
    jest.spyOn(fm, 'write').mockRejectedValue(new Error('write fail'))
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { })

    logger.info('will fallback')
    await new Promise(r => setTimeout(r, 0))

    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
    await logger.close()
  })
})

describe('Logger — log 参数分支', () => {
  it('无参数时 message 为空字符串', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.info()
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.message).toBe('')
  })

  it('string + 多参数时 data 为数组', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args2' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.info('msg', { a: 1 }, 2)
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.data).toEqual([{ a: 1 }, 2])
  })

  it('Error 作为第一个参数时 data 包含 additionalData', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args3' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.error(new Error('boom'), { a: 1 })
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.data.additionalData).toEqual([{ a: 1 }])
  })

  it('非字符串首参时 message 为空字符串，data 为数组或对象', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args4' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.info({ x: 1 }, 'y')
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.message).toBe('')
    expect(parsed.data).toEqual([{ x: 1 }, 'y'])
  })

  it('Error 作为唯一参数时 data 为 error 对象', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args5' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.error(new Error('only'))
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.data).toBeDefined()
  })

  it('Error message 为空时使用 String(error)', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args6' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.error(new Error(''))
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.message).toBe('Error')
  })

  it('非字符串单参数时 data 为对象本身', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'args7' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.info({ x: 1 })
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.data).toEqual({ x: 1 })
  })
})

describe('Logger — writeToConsole 分支', () => {
  it('error 级别使用 console.error', () => {
    const logger = new Logger({
      console: { enabled: true, colors: false, timestamp: false },
      file: { enabled: false },
      format: { includeStack: false },
    })
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => { })
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => { })
    logger.error('boom')
    expect(errSpy).toHaveBeenCalled()
    expect(logSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
    logSpy.mockRestore()
  })

  it('非 error 级别使用 console.log', () => {
    const logger = new Logger({
      console: { enabled: true, colors: false, timestamp: false },
      file: { enabled: false },
      format: { includeStack: false },
    })
    const errSpy = jest.spyOn(console, 'error').mockImplementation(() => { })
    const logSpy = jest.spyOn(console, 'log').mockImplementation(() => { })
    logger.info('ok')
    expect(logSpy).toHaveBeenCalled()
    expect(errSpy).not.toHaveBeenCalled()
    errSpy.mockRestore()
    logSpy.mockRestore()
  })
})

describe('Logger — debug()/warn()/error()', () => {
  it('debug 级别可写入文件', () => {
    const logger = new Logger({
      level: 'debug',
      file: { enabled: true, path: TEST_DIR, filename: 'dbg' },
      console: { enabled: false },
      format: { json: true, includeStack: false },
    })
    logger.debug('dbg')
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.message).toBe('dbg')
  })
})

describe('Logger — includeStack=true 时写入 file/line', () => {
  it('callerInfo 被写入 JSON 输出', () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'stack' },
      console: { enabled: false },
      format: { json: true, includeStack: true },
    })
    jest.spyOn((logger as any).callerInfoHelper, 'getCallerInfo')
      .mockReturnValue({ file: 'x.ts', line: 2 })
    logger.info('stacked')
    const file = fs.readdirSync(TEST_DIR).find(f => f.endsWith('.log'))!
    const line = fs.readFileSync(`${TEST_DIR}/${file}`, 'utf8').trim()
    const parsed = JSON.parse(line)
    expect(parsed.file).toBe('x.ts')
    expect(parsed.line).toBe(2)
  })
})

describe('Logger — onError 处理异常', () => {
  it('onError 抛错时仍继续处理', async () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'err' },
      console: { enabled: false },
      errorHandling: { onError: () => { throw new Error('handler fail') } },
    })
    const fm = (logger as any).fileManager
    jest.spyOn(fm, 'write').mockRejectedValue('write fail')
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { })
    logger.info('x')
    await new Promise(r => setTimeout(r, 0))
    expect(spy).toHaveBeenCalled()
    spy.mockRestore()
  })
})

describe('Logger — fileWriteError 预览截断', () => {
  it('长消息会被截断并带省略号', async () => {
    const logger = new Logger({
      file: { enabled: true, path: TEST_DIR, filename: 'long' },
      console: { enabled: false },
    })
    const fm = (logger as any).fileManager
    jest.spyOn(fm, 'write').mockRejectedValue(new Error('write fail'))
    let eventMessage = ''
    logger.on('fileWriteError', (e) => { eventMessage = e.message })
    const long = 'x'.repeat(200)
    logger.info(long)
    await new Promise(r => setTimeout(r, 0))
    expect(eventMessage).toContain('…')
  })
})
