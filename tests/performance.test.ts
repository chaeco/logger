/**
 * 性能基准测试
 * 测试各种配置下的性能表现
 */

import { Logger } from '../src/logger'
import * as fs from 'fs'

describe('Performance Benchmarks', () => {
  const testLogDir = './test-logs-perf'
  const loggers: Logger[] = []

  beforeAll(() => {
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  afterEach(async () => {
    // 关闭所有logger并等待队列刷新
    for (const logger of loggers) {
      await logger.close()
    }
    loggers.length = 0
    // 等待所有文件操作完成
    await new Promise(resolve => setTimeout(resolve, 100))
  })

  afterAll(async () => {
    // 确保所有logger都已关闭
    for (const logger of loggers) {
      await logger.close()
    }
    // 额外等待确保所有异步操作完成
    await new Promise(resolve => setTimeout(resolve, 200))
    if (fs.existsSync(testLogDir)) {
      fs.rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  describe('Synchronous vs Asynchronous Writing', () => {
    it('should benchmark sync write performance', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'sync-perf',
          writeMode: 'sync',
        },
      })
      loggers.push(logger)

      const iterations = 1000
      const start = Date.now()

      for (let i = 0; i < iterations; i++) {
        logger.info(`Sync log message ${i}`)
      }

      const duration = Date.now() - start
      const throughput = iterations / (duration / 1000)

      console.log(`Sync Write Performance:`)
      console.log(`  - Iterations: ${iterations}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${throughput.toFixed(2)} logs/sec`)

      expect(duration).toBeGreaterThan(0)
      expect(throughput).toBeGreaterThan(0)
    })

    it('should benchmark async write performance', async () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'async-perf',
          writeMode: 'async',
        },
        async: {
          enabled: true,
          queueSize: 2000,
          batchSize: 100,
          flushInterval: 1000,
        },
      })
      loggers.push(logger)

      const iterations = 1000
      const start = Date.now()

      for (let i = 0; i < iterations; i++) {
        logger.info(`Async log message ${i}`)
      }

      const duration = Date.now() - start
      const throughput = iterations / (duration / 1000)

      console.log(`Async Write Performance:`)
      console.log(`  - Iterations: ${iterations}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${throughput.toFixed(2)} logs/sec`)

      // 等待队列刷新
      await new Promise(resolve => setTimeout(resolve, 1500))

      expect(duration).toBeGreaterThan(0)
      expect(throughput).toBeGreaterThan(0)
    })

    it('should show async is faster than sync', async () => {
      const iterations = 500

      // Sync
      const syncLogger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'sync-compare',
        },
      })
      loggers.push(syncLogger)

      const syncStart = Date.now()
      for (let i = 0; i < iterations; i++) {
        syncLogger.info(`message ${i}`)
      }
      const syncDuration = Date.now() - syncStart

      // Async
      const asyncLogger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: {
          enabled: true,
          path: testLogDir,
          filename: 'async-compare',
        },
        async: {
          enabled: true,
          queueSize: 1000,
          batchSize: 100,
        },
      })
      loggers.push(asyncLogger)

      const asyncStart = Date.now()
      for (let i = 0; i < iterations; i++) {
        asyncLogger.info(`message ${i}`)
      }
      const asyncDuration = Date.now() - asyncStart

      console.log(`\nPerformance Comparison (${iterations} logs):`)
      console.log(`  - Sync:  ${syncDuration}ms`)
      console.log(`  - Async: ${asyncDuration}ms`)
      console.log(`  - Speed improvement: ${((syncDuration - asyncDuration) / syncDuration * 100).toFixed(1)}%`)

      await new Promise(resolve => setTimeout(resolve, 1500))

      expect(asyncDuration).toBeLessThan(syncDuration)
    })
  })

  describe('Format Performance', () => {
    it('should benchmark plain text formatting', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })
      loggers.push(logger)

      const iterations = 10000
      const start = Date.now()

      for (let i = 0; i < iterations; i++) {
        logger.info(`Plain text message ${i}`)
      }

      const duration = Date.now() - start
      const throughput = iterations / (duration / 1000)

      console.log(`\nPlain Text Format Performance:`)
      console.log(`  - Iterations: ${iterations}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${throughput.toFixed(2)} logs/sec`)

      expect(throughput).toBeGreaterThan(1000)
    })

    it('should benchmark JSON formatting', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
        format: {
          json: true,
          jsonIndent: 0,
        },
      })
      loggers.push(logger)

      const iterations = 10000
      const start = Date.now()

      for (let i = 0; i < iterations; i++) {
        logger.info(`JSON message ${i}`, { index: i, data: 'test' })
      }

      const duration = Date.now() - start
      const throughput = iterations / (duration / 1000)

      console.log(`\nJSON Format Performance:`)
      console.log(`  - Iterations: ${iterations}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${throughput.toFixed(2)} logs/sec`)

      expect(throughput).toBeGreaterThan(500)
    })
  })

  describe('Filtering Performance', () => {
    it('should benchmark filtering overhead', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
        filter: {
          enabled: true,
          filters: [
            (entry) => !entry.message.includes('skip'),
            (entry) => entry.level !== 'debug',
          ],
        },
      })
      loggers.push(logger)

      const iterations = 10000
      const start = Date.now()

      for (let i = 0; i < iterations; i++) {
        logger.info(`Filtered message ${i}`)
      }

      const duration = Date.now() - start
      const throughput = iterations / (duration / 1000)

      console.log(`\nFiltering Performance:`)
      console.log(`  - Iterations: ${iterations}`)
      console.log(`  - Duration: ${duration}ms`)
      console.log(`  - Throughput: ${throughput.toFixed(2)} logs/sec`)

      expect(throughput).toBeGreaterThan(500)
    })
  })

  describe('Memory Usage', () => {
    it('should track memory usage during high volume logging', () => {
      const logger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })
      loggers.push(logger)

      const startMemory = process.memoryUsage().heapUsed
      const iterations = 10000

      for (let i = 0; i < iterations; i++) {
        logger.info(`Memory test message ${i}`, { data: 'x'.repeat(100) })
      }

      const endMemory = process.memoryUsage().heapUsed
      const memoryIncrease = (endMemory - startMemory) / 1024 / 1024

      console.log(`\nMemory Usage:`)
      console.log(`  - Iterations: ${iterations}`)
      console.log(`  - Memory increase: ${memoryIncrease.toFixed(2)} MB`)
      console.log(`  - Per log: ${(memoryIncrease * 1024 / iterations).toFixed(2)} KB`)

      expect(memoryIncrease).toBeLessThan(100) // 不应超过100MB
    })
  })

  describe('Sampling Performance', () => {
    it('should show sampling improves performance', () => {
      const iterations = 10000

      // Without sampling
      const noSamplingLogger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
      })
      loggers.push(noSamplingLogger)

      const noSamplingStart = Date.now()
      for (let i = 0; i < iterations; i++) {
        noSamplingLogger.info(`message ${i}`)
      }
      const noSamplingDuration = Date.now() - noSamplingStart

      // With sampling
      const samplingLogger = new Logger({
        level: 'info',
        console: { enabled: false },
        file: { enabled: false },
        sampling: {
          enabled: true,
          rate: 0.1, // 10% sampling
        },
      })
      loggers.push(samplingLogger)

      const samplingStart = Date.now()
      for (let i = 0; i < iterations; i++) {
        samplingLogger.info(`message ${i}`)
      }
      const samplingDuration = Date.now() - samplingStart

      console.log(`\nSampling Performance Impact:`)
      console.log(`  - No sampling: ${noSamplingDuration}ms`)
      console.log(`  - With 10% sampling: ${samplingDuration}ms`)
      console.log(`  - Improvement: ${((noSamplingDuration - samplingDuration) / noSamplingDuration * 100).toFixed(1)}%`)

      const noSamplingMetrics = noSamplingLogger.getMetrics()
      const samplingMetrics = samplingLogger.getMetrics()

      console.log(`  - Logs processed: ${noSamplingMetrics.totalLogs} vs ${samplingMetrics.totalLogs}`)
      console.log(`  - Logs dropped: ${samplingMetrics.droppedLogs}`)
    })
  })
})
