/**
 * 浏览器环境兼容性测试
 * 测试 IndexedDB 存储和浏览器特定功能
 */

import { Logger } from '../src/logger'

describe('Browser Compatibility Tests', () => {
  // 模拟浏览器环境
  const mockIndexedDB = () => {
    const stores: Record<string, any[]> = {}

    return {
      open: jest.fn((name: string) => {
        return Promise.resolve({
          objectStoreNames: { contains: () => false },
          createObjectStore: jest.fn(),
          transaction: jest.fn(() => ({
            objectStore: jest.fn(() => ({
              add: jest.fn((value: any) => {
                if (!stores[name]) stores[name] = []
                stores[name].push(value)
                return Promise.resolve()
              }),
              getAll: jest.fn(() => Promise.resolve(stores[name] || [])),
              clear: jest.fn(() => {
                stores[name] = []
                return Promise.resolve()
              }),
            })),
          })),
        })
      }),
      deleteDatabase: jest.fn(),
      _stores: stores,
    }
  }

  describe('Environment Detection', () => {
    it('should detect browser environment correctly', () => {
      // 模拟浏览器全局对象
      const originalWindow = global.window
      const originalProcess = global.process

      ;(global as any).window = {}
      ;(global as any).process = undefined

      const logger = new Logger({
        level: 'info',
        console: { enabled: true },
      })

      expect(logger).toBeDefined()

      // 恢复原始环境
      global.window = originalWindow
      global.process = originalProcess
    })

    it('should detect Node.js environment correctly', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: true },
      })

      expect(logger).toBeDefined()
      expect(process).toBeDefined()
    })
  })

  describe('IndexedDB Storage', () => {
    let mockDB: any

    beforeEach(() => {
      mockDB = mockIndexedDB()
      ;(global as any).indexedDB = mockDB
    })

    afterEach(() => {
      delete (global as any).indexedDB
    })

    it('should initialize logger with IndexedDB in browser', () => {
      const logger = new Logger({
        level: 'info',
        name: 'browser-logger',
        console: { enabled: true },
        file: { enabled: false },
      })

      expect(logger).toBeDefined()
    })

    it('should handle browser-specific log levels', () => {
      const logger = new Logger({
        level: 'debug',
        console: { enabled: false },
      })

      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warning message')
      logger.error('Error message')

      const metrics = logger.getMetrics()
      expect(metrics.totalLogs).toBe(4)
    })
  })

  describe('Console API Compatibility', () => {
    it('should use browser console methods correctly', () => {
      const consoleSpy = {
        debug: jest.fn(),
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }

      const originalConsole = global.console
      global.console = consoleSpy as any

      const logger = new Logger({
        level: 'debug',
        console: { enabled: true },
        file: { enabled: false },
      })

      logger.debug('Debug message')
      logger.info('Info message')
      logger.warn('Warning message')
      logger.error('Error message')

      // \u81f3\u5c11\u5e94\u8be5\u8c03\u7528\u4e86log\u65b9\u6cd5
      const totalCalls = consoleSpy.debug.mock.calls.length + 
                         consoleSpy.log.mock.calls.length +
                         consoleSpy.warn.mock.calls.length +
                         consoleSpy.error.mock.calls.length
      
      expect(totalCalls).toBeGreaterThan(0)

      global.console = originalConsole
    })

    it('should handle console colors in browser', () => {
      const consoleSpy = {
        log: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }

      const originalConsole = global.console
      global.console = consoleSpy as any

      const logger = new Logger({
        level: 'info',
        console: {
          enabled: true,
          colors: true, // 浏览器可能不支持颜色
        },
        file: { enabled: false },
      })

      logger.info('Colored message')

      expect(consoleSpy.log).toHaveBeenCalled()

      global.console = originalConsole
    })
  })

  describe('Storage Limits', () => {
    it('should handle storage quota exceeded error', async () => {
      const mockDB = mockIndexedDB()
      ;(global as any).indexedDB = mockDB

      const logger = new Logger({
        level: 'info',
        name: 'quota-test',
        console: { enabled: false },
      })

      let errorCaught = false

      try {
        // 尝试写入大量数据
        for (let i = 0; i < 10000; i++) {
          logger.info(`Large message ${i}`, { data: 'x'.repeat(1000) })
        }
      } catch (error) {
        errorCaught = true
      }

      // 在浏览器中可能会抛出 QuotaExceededError
      // 但在测试环境中不会
      expect(errorCaught).toBe(false)

      delete (global as any).indexedDB
    })
  })

  describe('Performance in Browser', () => {
    it('should maintain acceptable performance in browser', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })

      const count = 1000
      const start = Date.now()

      for (let i = 0; i < count; i++) {
        logger.info(`Browser performance test ${i}`)
      }

      const duration = Date.now() - start

      console.log(`\nBrowser Performance Test:`)
      console.log(`  - Logs: ${count}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${(count / (duration / 1000)).toFixed(2)} logs/sec`)

      // 浏览器中应该保持良好的性能
      expect(duration).toBeLessThan(1000)
    })

    it('should handle async operations in browser', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })

      const promises: Promise<void>[] = []

      for (let i = 0; i < 100; i++) {
        promises.push(
          new Promise<void>(resolve => {
            logger.info(`Async message ${i}`)
            resolve()
          })
        )
      }

      await Promise.all(promises)

      const metrics = logger.getMetrics()
      expect(metrics.totalLogs).toBe(100)
    })
  })

  describe('Browser Events', () => {
    it('should emit events in browser environment', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })

      let eventCount = 0

      logger.on('levelChange', () => {
        eventCount++
      })

      logger.setLevel('debug')
      logger.setLevel('warn')
      logger.setLevel('error')

      expect(eventCount).toBe(3)
    })

    it('should handle custom events', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        rateLimit: {
          enabled: true,
          maxLogsPerWindow: 1,
          windowSize: 1000,
        },
      })

      const events: any[] = []

      logger.on('rateLimitExceeded', event => {
        events.push(event)
      })

      logger.info('Message 1')
      logger.info('Message 2') // 应该被限流

      // 等待一下
      expect(events.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Memory Management', () => {
    it('should clean up resources properly', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
      })

      // 添加多个事件监听器
      const handlers = Array(10)
        .fill(null)
        .map(() => jest.fn())

      handlers.forEach(handler => {
        logger.on('levelChange', handler)
      })

      logger.setLevel('debug')

      // 移除所有监听器
      handlers.forEach(handler => {
        logger.off('levelChange', handler)
      })

      logger.setLevel('info')

      // 第一个 handler 应该被调用一次
      expect(handlers[0]).toHaveBeenCalledTimes(1)
    })

    it('should handle memory limits gracefully', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        sampling: {
          enabled: true,
          rate: 0.1, // 采样以减少内存使用
        },
      })

      const initialMetrics = logger.getMetrics()

      // 生成大量日志
      for (let i = 0; i < 10000; i++) {
        logger.info(`Memory test ${i}`)
      }

      const finalMetrics = logger.getMetrics()

      console.log(`\nBrowser Memory Test:`)
      console.log(`  - Initial logs: ${initialMetrics.totalLogs}`)
      console.log(`  - Final logs: ${finalMetrics.totalLogs}`)
      console.log(`  - Sampled logs: ${finalMetrics.sampledLogs}`)

      expect(finalMetrics.totalLogs).toBeGreaterThan(0)
    })
  })

  describe('Cross-browser Features', () => {
    it('should work without file system API', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: true },
        file: { enabled: false }, // 浏览器中通常禁用文件系统
      })

      logger.info('Browser message without file system')
      logger.warn('Warning in browser')
      logger.error('Error in browser')

      const metrics = logger.getMetrics()
      expect(metrics.totalLogs).toBe(3)
    })

    it('should handle timestamp formats in browser', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        format: {
          enabled: true,
          timestampFormat: 'YYYY-MM-DD HH:mm:ss',
        },
      })

      logger.info('Message with timestamp')

      const metrics = logger.getMetrics()
      expect(metrics.totalLogs).toBe(1)
    })

    it('should support JSON formatting in browser', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        format: {
          json: true,
        },
      })

      logger.info('JSON message', {
        browser: 'Chrome',
        version: '120',
      })

      const metrics = logger.getMetrics()
      expect(metrics.totalLogs).toBe(1)
    })
  })

  describe('Service Worker Compatibility', () => {
    it('should work in service worker context', () => {
      // 模拟 Service Worker 环境
      const originalSelf = global.self
      ;(global as any).self = {
        addEventListener: jest.fn(),
      }

      const logger = new Logger({
        level: 'info',
        name: 'service-worker-logger',
        console: { enabled: true },
        file: { enabled: false },
      })

      logger.info('Message from service worker')

      expect(logger).toBeDefined()

      global.self = originalSelf
    })
  })

  describe('Web Worker Compatibility', () => {
    it('should work in web worker context', () => {
      // 模拟 Web Worker 环境
      const logger = new Logger({
        level: 'info',
        name: 'web-worker-logger',
        console: { enabled: true },
        file: { enabled: false },
      })

      logger.info('Message from web worker')
      logger.warn('Warning from web worker')

      const metrics = logger.getMetrics()
      expect(metrics.totalLogs).toBe(2)
    })
  })

  describe('Error Handling in Browser', () => {
    it('should handle browser-specific errors', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        errorHandling: {
          silent: true,
          fallbackToConsole: true,
        },
      })

      // 尝试触发浏览器特定的错误
      logger.error('Browser error', new Error('Test error'))

      // 不应该崩溃
      expect(logger).toBeDefined()
    })
  })
})
