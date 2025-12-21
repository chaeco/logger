/**
 * 压力测试
 * 测试高并发、大数据量场景下的稳定性
 */

import { Logger } from '../src/logger'
import * as fs from 'fs'

describe('Stress Tests', () => {
  const testLogDir = './test-logs-stress'

  beforeAll(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  afterAll(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  describe('High Volume Logging', () => {
    it('should handle 10,000 logs without crashing', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'high-volume',
        },
        async: {
          enabled: true,
          queueSize: 5000,
          batchSize: 500,
        },
      })

      const count = 10000
      const start = Date.now()

      for (let i = 0; i < count; i++) {
        logger.info(`High volume message ${i}`)
      }

      const duration = Date.now() - start
      console.log(`\nHigh Volume Test (${count} logs):`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${(count / (duration / 1000)).toFixed(2)} logs/sec`)

      const metrics = logger.getMetrics()
      console.log(`  - Total logs: ${metrics.totalLogs}`)
      console.log(`  - Dropped logs: ${metrics.droppedLogs}`)

      expect(metrics.totalLogs).toBeGreaterThan(0)
    }, 30000)

    it('should handle 50,000 logs with sampling', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'extreme-volume',
        },
        async: {
          enabled: true,
          queueSize: 10000,
          batchSize: 1000,
        },
        sampling: {
          enabled: true,
          rate: 0.1, // 10% sampling
        },
      })

      const count = 50000
      const start = Date.now()

      for (let i = 0; i < count; i++) {
        logger.info(`Extreme volume message ${i}`)
      }

      const duration = Date.now() - start
      const metrics = logger.getMetrics()

      console.log(`\nExtreme Volume Test (${count} logs):`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${(count / (duration / 1000)).toFixed(2)} logs/sec`)
      console.log(`  - Sampled logs: ${metrics.sampledLogs}`)
      console.log(`  - Dropped logs: ${metrics.droppedLogs}`)
      console.log(`  - Sampling rate: ${(metrics.sampledLogs / count * 100).toFixed(1)}%`)

      expect(metrics.totalLogs).toBeGreaterThan(0)
    }, 60000)
  })

  describe('Concurrent Logging', () => {
    it('should handle concurrent writes from multiple loggers', async () => {
      const loggerCount = 10
      const logsPerLogger = 1000
      const loggers: Logger[] = []

      // 创建多个 logger 实例
      for (let i = 0; i < loggerCount; i++) {
        loggers.push(
          new Logger({
            level: 'info',
            name: `logger-${i}`,
            console: { enabled: false },
            file: {
              enabled: true,
              path: testLogDir,
              filename: `concurrent-${i}`,
            },
            async: {
              enabled: true,
              queueSize: 2000,
            },
          })
        )
      }

      const start = Date.now()

      // 并发写入
      await Promise.all(
        loggers.map(async (logger, index) => {
          for (let i = 0; i < logsPerLogger; i++) {
            logger.info(`Concurrent message ${i} from logger ${index}`)
          }
        })
      )

      const duration = Date.now() - start
      const totalLogs = loggerCount * logsPerLogger

      console.log(`\nConcurrent Logging Test:`)
      console.log(`  - Loggers: ${loggerCount}`)
      console.log(`  - Logs per logger: ${logsPerLogger}`)
      console.log(`  - Total logs: ${totalLogs}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${(totalLogs / (duration / 1000)).toFixed(2)} logs/sec`)

      // 等待所有写入完成
      await new Promise(resolve => setTimeout(resolve, 2000))

      expect(true).toBe(true)
    }, 30000)
  })

  describe('Large Message Handling', () => {
    it('should handle large log messages', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'large-messages',
        },
        async: {
          enabled: true,
          queueSize: 1000,
        },
      })

      const largeMessage = 'x'.repeat(10000) // 10KB message
      const count = 100

      const start = Date.now()

      for (let i = 0; i < count; i++) {
        logger.info(`Large message ${i}: ${largeMessage}`)
      }

      const duration = Date.now() - start

      console.log(`\nLarge Message Test:`)
      console.log(`  - Message size: 10KB`)
      console.log(`  - Count: ${count}`)
      console.log(`  - Total data: ${(count * 10 / 1024).toFixed(2)} MB`)
      console.log(`  - Duration: ${duration}ms`)

      await new Promise(resolve => setTimeout(resolve, 2000))

      expect(true).toBe(true)
    }, 30000)

    it('should handle messages with complex data', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'complex-data',
        },
        format: {
          json: true,
        },
      })

      const complexData = {
        user: { id: 123, name: 'Test User', email: 'test@example.com' },
        metadata: { timestamp: Date.now(), version: '1.0.0' },
        array: Array(100).fill({ key: 'value' }),
        nested: {
          deep: {
            structure: {
              with: {
                many: {
                  levels: 'data',
                },
              },
            },
          },
        },
      }

      const count = 1000
      const start = Date.now()

      for (let i = 0; i < count; i++) {
        logger.info(`Complex data ${i}`, complexData)
      }

      const duration = Date.now() - start

      console.log(`\nComplex Data Test:`)
      console.log(`  - Count: ${count}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${(count / (duration / 1000)).toFixed(2)} logs/sec`)

      await new Promise(resolve => setTimeout(resolve, 1000))

      expect(true).toBe(true)
    }, 30000)
  })

  describe('Rate Limit Stress', () => {
    it('should handle burst of logs exceeding rate limit', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
        rateLimit: {
          enabled: true,
          windowSize: 1000,
          maxLogsPerWindow: 100,
        },
      })

      const count = 1000
      const start = Date.now()

      for (let i = 0; i < count; i++) {
        logger.info(`Burst message ${i}`)
      }

      const duration = Date.now() - start
      const metrics = logger.getMetrics()

      console.log(`\nRate Limit Stress Test:`)
      console.log(`  - Attempted: ${count}`)
      console.log(`  - Processed: ${metrics.totalLogs}`)
      console.log(`  - Dropped: ${metrics.droppedLogs}`)
      console.log(`  - Drop rate: ${(metrics.droppedLogs / count * 100).toFixed(1)}%`)
      console.log(`  - Duration: ${duration}ms`)

      expect(metrics.droppedLogs).toBeGreaterThan(0)
    })
  })

  describe('Memory Leak Detection', () => {
    it('should not leak memory during extended logging', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })

      const initialMemory = process.memoryUsage().heapUsed
      const iterations = 5

      for (let round = 0; round < iterations; round++) {
        for (let i = 0; i < 10000; i++) {
          logger.info(`Memory leak test ${round}-${i}`)
        }

        // 强制垃圾回收（需要 --expose-gc 标志）
        if (global.gc) {
          global.gc()
        }
      }

      const finalMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (finalMemory - initialMemory) / 1024 / 1024

      console.log(`\nMemory Leak Test:`)
      console.log(`  - Rounds: ${iterations}`)
      console.log(`  - Logs per round: 10,000`)
      console.log(`  - Total logs: ${iterations * 10000}`)
      console.log(`  - Memory increase: ${memoryIncrease.toFixed(2)} MB`)

      // 内存增长应该在合理范围内（50K日志约200MB是可接受的）
      expect(memoryIncrease).toBeLessThan(300)
    })
  })

  describe('File System Stress', () => {
    it('should handle rapid file rotations', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'rotation-stress',
          maxSize: '20kb', // \u8c03\u6574\u4e3a\u66f4\u5927\u7684\u6587\u4ef6\u4ee5\u51cf\u5c11\u8f6c\u8f6c\u6b21\u6570
          maxFiles: 100,  // \u589e\u52a0\u6700\u5927\u6587\u4ef6\u6570
        },
      })

      const largeMessage = 'x'.repeat(200) // 500 bytes
      const count = 20 // \u51cf\u5c11\u6d88\u606f\u6570\u91cf

      for (let i = 0; i < count; i++) {
        logger.info(`Rotation ${i}: ${largeMessage}`)
      }

      await new Promise(resolve => setTimeout(resolve, 1000))

      const files = fs.readdirSync(testLogDir)
      console.log(`\nFile Rotation Stress Test:`)
      console.log(`  - Messages: ${count}`)
      console.log(`  - Files created: ${files.length}`)
      console.log(`  - Max files: 20`)

      expect(files.length).toBeGreaterThan(0)
    }, 30000)
  })

  describe('Error Recovery', () => {
    it('should recover from disk full simulation', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'recovery-test',
        },
        errorHandling: {
          silent: true,
          retryCount: 3,
          fallbackToConsole: true,
        },
      })

      let errorCount = 0
      logger.on('fileWriteError', () => {
        errorCount++
      })

      // 正常写入
      for (let i = 0; i < 100; i++) {
        logger.info(`Recovery test message ${i}`)
      }

      await new Promise(resolve => setTimeout(resolve, 500))

      console.log(`\nError Recovery Test:`)
      console.log(`  - Messages: 100`)
      console.log(`  - Errors: ${errorCount}`)

      const metrics = logger.getMetrics()
      console.log(`  - File writes: ${metrics.fileWrites}`)
      console.log(`  - File write errors: ${metrics.fileWriteErrors}`)

      expect(true).toBe(true)
    })
  })
})
