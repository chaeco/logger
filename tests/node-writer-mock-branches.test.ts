import { Readable } from 'stream'

let warnSpy: jest.SpyInstance
let errorSpy: jest.SpyInstance

beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => { })
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => { })
})

afterEach(() => {
  warnSpy.mockRestore()
  errorSpy.mockRestore()
})

describe('NodeWriter — mocked fs branches', () => {
  it('ensureLogDirectory 捕获非 Error 异常', () => {
    jest.isolateModules(() => {
      jest.doMock('fs', () => {
        const real = jest.requireActual('fs')
        return {
          ...real,
          existsSync: () => false,
          mkdirSync: () => { throw 'boom' },
        }
      })
      const { NodeWriter } = require('../src/file/node-writer')
      const w = new NodeWriter({
        enabled: true,
        path: './logs',
        filename: 'app',
        maxSize: 10,
        maxFiles: 1,
        maxAge: 1,
        compress: false,
        retryCount: 0,
        retryDelay: 0,
      })
      w.init()
      expect(w.initError).toBeDefined()
    })
    jest.resetModules()
  })

  it('initializeCurrentFile 捕获非 Error 异常', () => {
    jest.isolateModules(() => {
      jest.doMock('fs', () => {
        const real = jest.requireActual('fs')
        return {
          ...real,
          existsSync: () => true,
          statSync: () => { throw 'stat fail' },
        }
      })
      const { NodeWriter } = require('../src/file/node-writer')
      const w = new NodeWriter({
        enabled: true,
        path: './logs',
        filename: 'app',
        maxSize: 10,
        maxFiles: 1,
        maxAge: 1,
        compress: false,
        retryCount: 0,
        retryDelay: 0,
      })
      w.init()
      expect(w.initError).toBeDefined()
    })
    jest.resetModules()
  })

  it('appendToFileWithRetry 捕获非 Error 异常', async () => {
    await new Promise<void>((resolve) => {
      jest.isolateModules(async () => {
        jest.doMock('fs', () => {
          const real = jest.requireActual('fs')
          return {
            ...real,
            existsSync: () => true,
            mkdirSync: () => { },
            appendFileSync: () => { throw 'write fail' },
          }
        })
        const { NodeWriter } = require('../src/file/node-writer')
        const w = new NodeWriter({
          enabled: true,
          path: './logs',
          filename: 'app',
          maxSize: 10,
          maxFiles: 1,
          maxAge: 1,
          compress: false,
          retryCount: 0,
          retryDelay: 0,
        })
        w.init()
        await expect((w as any).appendToFileWithRetry('x')).rejects.toThrow()
        resolve()
      })
    })
    jest.resetModules()
  })

  it('streamCompressDayFiles 处理 string chunk 分支', async () => {
    await new Promise<void>((resolve) => {
      jest.isolateModules(async () => {
        jest.doMock('fs', () => {
          const real = jest.requireActual('fs')
          return {
            ...real,
            createReadStream: () => Readable.from(['abc']),
          }
        })
        const { NodeWriter } = require('../src/file/node-writer')
        const w = new NodeWriter({
          enabled: true,
          path: './logs',
          filename: 'app',
          maxSize: 10,
          maxFiles: 1,
          maxAge: 1,
          compress: false,
          retryCount: 0,
          retryDelay: 0,
        })
        await (w as any).streamCompressDayFiles(
          [{ name: 'a.log', path: 'a.log' }],
          '/tmp/out.gz',
        )
        resolve()
      })
    })
    jest.resetModules()
  })
})
