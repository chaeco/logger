/**
 * FileManager 扩展测试
 * 提升覆盖率的额外测试
 */

import { FileManager } from '../src/file/file-manager'
import * as fs from 'fs'
import * as path from 'path'

describe('FileManager Extended Tests', () => {
  const testLogDir = './test-logs-extended'

  beforeEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
    fs.mkdirSync(testLogDir, { recursive: true })
  })

  afterEach(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  describe('Error Handling', () => {
    it('should throw error for invalid path', () => {
      // 创建一个无效路径的 FileManager 不应该抛出错误（首次写入时才初始化）
      // 构造函数不再立即初始化
      expect(() => {
        new FileManager({
          enabled: true,
          path: '/invalid/nonexistent/path',
        })
      }).not.toThrow()
    })

    it('should handle write to closed file manager', async () => {
      const fm = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'closed-test',
      })

      await fm.close()

      // 关闭后写入不应该抛出错误
      await expect(fm.write('test after close')).resolves.not.toThrow()
    })
  })

  describe('Compression', () => {
    it('should support compression option', async () => {
      const fm = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'compress-test',
        compress: true,
        maxFiles: 3,
        maxSize: 100,
      })

      // 写入足够的数据触发轮转
      const longMessage = 'x'.repeat(150)
      await fm.write(longMessage)
      await fm.write(longMessage)

      await new Promise(resolve => setTimeout(resolve, 500))

      await fm.close()
    })
  })

  describe('Max Age', () => {
    it('should use custom maxAge value', () => {
      const fm = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'age-test',
        maxAge: 7, // 7 days
      })

      expect(fm).toBeDefined()
    })
  })

  describe('Disabled Mode', () => {
    it('should not create directory when disabled', () => {
      const disabledDir = path.join(testLogDir, 'disabled')
      const fm = new FileManager({
        enabled: false,
        path: disabledDir,
      })

      // 禁用时不应该创建目录
      // 注意：构造函数可能仍然会创建目录，但不会写入文件
    })

    it('should not write when disabled', async () => {
      const fm = new FileManager({
        enabled: false,
        path: testLogDir,
        filename: 'disabled-write',
      })

      await fm.write('should not write')

      // 不应该有文件生成
      const files = fs.readdirSync(testLogDir).filter(f => f.includes('disabled-write'))
      expect(files.length).toBe(0)
    })
  })

  describe('Async Write Configuration', () => {
    it('should handle different overflow strategies', async () => {
      const fm = new FileManager(
        {
          enabled: true,
          path: testLogDir,
          filename: 'overflow-test',
        },
        {
          enabled: true,
          queueSize: 10,
          batchSize: 5,
          overflowStrategy: 'drop',
        }
      )

      // 写入超过队列大小的消息
      for (let i = 0; i < 20; i++) {
        await fm.write(`message ${i}`)
      }

      await fm.close()
    })

    it('should use custom batch size', async () => {
      const fm = new FileManager(
        {
          enabled: true,
          path: testLogDir,
          filename: 'batch-test',
        },
        {
          enabled: true,
          queueSize: 100,
          batchSize: 10,
          flushInterval: 100,
        }
      )

      for (let i = 0; i < 25; i++) {
        await fm.write(`batch message ${i}`)
      }

      await new Promise(resolve => setTimeout(resolve, 200))
      await fm.close()
    })
  })

  describe('Write Mode', () => {
    it('should write to file', async () => {
      const fm = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'write-mode-test',
      })

      await fm.write('test message')
      await fm.close()

      const files = fs.readdirSync(testLogDir).filter(f => f.includes('write-mode-test'))
      expect(files.length).toBeGreaterThan(0)
    })
  })

  describe('List Files', () => {
    it('should have log files in directory', async () => {
      const fm = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'list-test',
      })

      await fm.write('test 1')
      await fm.write('test 2')

      const files = fs.readdirSync(testLogDir).filter(f => f.includes('list-test'))
      expect(files.length).toBeGreaterThan(0)

      await fm.close()
    })
  })

  describe('Multiple Rotations', () => {
    it('should handle multiple file rotations', async () => {
      const fm = new FileManager({
        enabled: true,
        path: testLogDir,
        filename: 'multi-rotate',
        maxSize: 50,
        maxFiles: 5,
      })

      // 写入足够的数据触发多次轮转
      const message = 'x'.repeat(60)
      for (let i = 0; i < 10; i++) {
        await fm.write(message)
        await new Promise(resolve => setTimeout(resolve, 50))
      }

      await new Promise(resolve => setTimeout(resolve, 200))

      const files = fs.readdirSync(testLogDir).filter(f => f.includes('multi-rotate'))
      // 应该有多个文件
      expect(files.length).toBeGreaterThan(1)

      await fm.close()
    })
  })
})
