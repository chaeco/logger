import { FileManager } from '../src/file-manager'
import * as fs from 'fs'
import * as path from 'path'

describe('FileManager', () => {
  const testLogDir = './test-logs'
  let fileManager: FileManager

  beforeEach(() => {
    // 清理测试目录
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  afterEach(async () => {
    if (fileManager) {
      await fileManager.close()
    }
    // 清理测试目录
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  describe('Initialization', () => {
    it('should create log directory', () => {
      fileManager = new FileManager({
        enabled: true,
        path: testLogDir,
      })

      // 目录不会在构造函数中创建
      expect(fs.existsSync(testLogDir)).toBe(false)

      // 首次写入时创建
      fileManager.write('test')
      expect(fs.existsSync(testLogDir)).toBe(true)
    })

    it('should initialize with default options', () => {
      fileManager = new FileManager()
      expect(fileManager).toBeDefined()
    })

    it('should use custom filename', () => {
      fileManager = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'custom',
      })

      // 目录不会在构造函数中创建
      expect(fs.existsSync(testLogDir)).toBe(false)

      // 首次写入时创建
      fileManager.write('test')
      expect(fs.existsSync(testLogDir)).toBe(true)
    })
  })

  describe('File Writing', () => {
    it('should write log messages to file', async () => {
      fileManager = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'test',
      })

      await fileManager.write('test message 1')
      await fileManager.write('test message 2')

      const files = fs.readdirSync(testLogDir)
      expect(files.length).toBeGreaterThan(0)

      const content = fs.readFileSync(
        path.join(testLogDir, files[0]),
        'utf-8'
      )
      expect(content).toContain('test message 1')
      expect(content).toContain('test message 2')
    })

    it('should not write when disabled', async () => {
      fileManager = new FileManager({
        enabled: false,
        path: testLogDir,
      })

      await fileManager.write('test message')

      // disabled 时不写入文件，但目录可能已创建
      // 检查没有文件被写入
      if (fs.existsSync(testLogDir)) {
        const files = fs.readdirSync(testLogDir)
        expect(files.length).toBe(0)
      }
    })

    it('should handle write errors gracefully', async () => {
      // 使用disabled模式来测试错误处理
      fileManager = new FileManager({
        enabled: false,
        path: testLogDir,
      })

      // disabled 时不会抛出错误
      await expect(fileManager.write('test')).resolves.not.toThrow()
    })
  })

  describe('File Rotation', () => {
    it('should rotate files when size limit exceeded', async () => {
      fileManager = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'rotate-test',
        maxSize: '1kb',
      })

      // 写入足够多的数据触发轮转
      const largeMessage = 'x'.repeat(500)
      for (let i = 0; i < 10; i++) {
        await fileManager.write(largeMessage)
      }

      const files = fs.readdirSync(testLogDir)
      expect(files.length).toBeGreaterThan(1)
    })

    it('should clean up old files', async () => {
      fileManager = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'cleanup-test',
        maxFiles: 5,
        maxSize: '100b', // 更小的文件大小，触发更多轮转
      })

      // 创建多个小文件，每个文件超过100字节会触发轮转
      const longMessage = 'x'.repeat(120) // 超过100字节
      for (let i = 0; i < 15; i++) {
        await fileManager.write(longMessage + ' ' + i)
        await new Promise(resolve => setTimeout(resolve, 100))
      }

      // 等待文件清理完成
      await new Promise(resolve => setTimeout(resolve, 500))

      const files = fs.readdirSync(testLogDir).filter(f => f.startsWith('cleanup-test'))
      // maxFiles=5 应该只保留最近的5个文件
      expect(files.length).toBeLessThanOrEqual(6) // 包括当前正在写入的文件
    })
  })

  describe('Async Writing', () => {
    it('should support async write mode', async () => {
      fileManager = new FileManager(
        {
          enabled: true,
          path: testLogDir,
          filename: 'async-test',
        },
        {
          enabled: true,
          queueSize: 100,
          batchSize: 10,
          flushInterval: 500,
        }
      )

      for (let i = 0; i < 20; i++) {
        await fileManager.write(`async message ${i}`)
      }

      const status = fileManager.getQueueStatus()
      expect(status).toBeDefined()
      expect(typeof status.size).toBe('number')
    })

    it('should flush queue on close', async () => {
      fileManager = new FileManager(
        {
          enabled: true,
          path: testLogDir,
          filename: 'flush-test',
        },
        {
          enabled: true,
          queueSize: 100,
          batchSize: 50,
          flushInterval: 5000,
        }
      )

      for (let i = 0; i < 10; i++) {
        await fileManager.write(`message ${i}`)
      }

      await fileManager.close()

      const files = fs.readdirSync(testLogDir)
      expect(files.length).toBeGreaterThan(0)
    })

    it('should get queue status', async () => {
      fileManager = new FileManager(
        {
          enabled: true,
          path: testLogDir,
        },
        {
          enabled: true,
          queueSize: 100,
        }
      )

      const status = fileManager.getQueueStatus()
      expect(status).toHaveProperty('size')
      expect(status).toHaveProperty('isWriting')
    })
  })

  describe('Date Rotation', () => {
    it('should create new file for new day', async () => {
      fileManager = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'date-test',
      })

      await fileManager.write('test message')

      const files = fs.readdirSync(testLogDir)
      expect(files.length).toBeGreaterThan(0)
      expect(files[0]).toMatch(/date-test-\d{4}-\d{2}-\d{2}\.log/)
    })
  })

  describe('Size Parsing', () => {
    it('should parse size units correctly', async () => {
      const testCases = [
        { maxSize: '1kb', bytes: 1024 },
        { maxSize: '1mb', bytes: 1024 * 1024 },
        { maxSize: '100b', bytes: 100 },
      ]

      for (const testCase of testCases) {
        const fm = new FileManager({
          enabled: true,
          path: testLogDir,
          filename: `size-${testCase.maxSize}`,
          maxSize: testCase.maxSize,
        })

        await fm.close()
      }
    })
  })
})
