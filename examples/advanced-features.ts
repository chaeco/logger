/**
 * @chaeco/logger 高级特性示例
 *
 * 演示三大优化特性的使用方法：
 * 1. 堆栈解析缓存（Stack Parsing Cache）
 * 2. 日志过滤器（Log Filtering）
 * 3. 性能指标（Performance Metrics）
 */

import { Logger, LoggerFilter, FilterOptions, PerformanceMetrics } from '../src/index'

/**
 * 示例 1: 堆栈解析缓存
 *
 * 日志系统会自动缓存堆栈解析结果，对于频繁调用的日志，
 * 性能可以提升约 10 倍。
 */
export function stackCacheExample() {
  const logger = new Logger({
    level: 'info',
    console: { enabled: true, timestamp: true },
  })

  console.log('=== 堆栈解析缓存示例 ===')

  // 从相同位置多次调用日志
  for (let i = 0; i < 1000; i++) {
    logger.info('处理任务', { taskId: i })
  }

  // 查看性能指标
  const metrics = logger.getMetrics()
  console.log(`
📊 性能指标:
  - 总日志数: ${metrics.totalLogs}
  - 平均处理时间: ${metrics.avgProcessingTime.toFixed(2)}ms
  - 文件写入: ${metrics.fileWrites}
  `)
}

/**
 * 示例 2: 日志过滤器
 *
 * 灵活的过滤器机制，支持条件组合（AND/OR）
 */
export function filterExample() {
  const logger = new Logger({
    level: 'debug',
    console: { enabled: true },
  })

  console.log('=== 日志过滤器示例 ===')

  // 配置过滤器：只记录错误日志或包含 'api' 的日志
  logger.configureFilter({
    enabled: true,
    filters: [
      (entry) => entry.level === 'error' || (entry.message?.includes('api') || false),
    ],
    mode: 'any',
  })

  logger.debug('调试信息')      // ❌ 被过滤（不是错误，不含 'api'）
  logger.info('API 请求开始')   // ✅ 通过（包含 'api'）
  logger.error('发生错误')      // ✅ 通过（是错误）
  logger.warn('警告信息')       // ❌ 被过滤（不是错误，不含 'api'）

  const metrics = logger.getMetrics()
  console.log(`
📊 过滤统计:
  - 总日志数: ${metrics.totalLogs}
  - 过滤数: ${metrics.filteredLogs}
  `)
}

/**
 * 示例 3: 性能指标监控
 *
 * 实时获取日志系统的性能数据
 */
export function metricsExample() {
  const logger = new Logger({
    level: 'info',
    console: { enabled: false },
  })

  console.log('=== 性能指标示例 ===')

  // 记录一些日志
  for (let i = 0; i < 100; i++) {
    if (i % 2 === 0) {
      logger.info('正常日志')
    } else {
      logger.error('错误日志')
    }
  }

  // 获取完整指标
  const metrics = logger.getMetrics()
  console.log(`
📊 完整指标:
  - 总日志数: ${metrics.totalLogs}
  - 采样日志数: ${metrics.sampledLogs}
  - 过滤日志数: ${metrics.filteredLogs}
  - 丢弃日志数: ${metrics.droppedLogs}
  - 平均处理时间: ${metrics.avgProcessingTime.toFixed(3)}ms
  - 文件写入次数: ${metrics.fileWrites}
  - 文件写入错误: ${metrics.fileWriteErrors}
  - 指标生成时间: ${metrics.timestamp}
  `)

  // 重置指标
  logger.resetMetrics()
  console.log('✓ 指标已重置')
}

/**
 * 示例 4: 综合使用
 *
 * 组合使用所有新功能
 */
export async function combinedExample() {
  const logger = new Logger({
    level: 'debug',
    console: { enabled: true, timestamp: true },
    file: {
      enabled: true,
      path: './logs',
      maxSize: '10m',
      maxFiles: 10,
    },
  })

  console.log('=== 综合示例：生产级别日志配置 ===')

  // 1. 配置过滤器：排除健康检查日志
  logger.configureFilter({
    enabled: true,
    filters: [
      (entry) => !entry.message?.includes('health'),  // 排除健康检查
      (entry) => entry.level !== 'debug',            // 不记录 debug
    ],
    mode: 'all',
  })

  // 2. 配置采样
  logger.configureSampling({
    enabled: true,
    rateByLevel: {
      debug: 0.01,
      info: 0.1,
      warn: 1,
      error: 1,
    },
  })

  // 3. 配置限流
  logger.configureRateLimit({
    enabled: true,
    windowSize: 10000,
    maxLogsPerWindow: 5000,
  })

  // 4. 监听错误事件
  logger.on('fileWriteError', (event) => {
    console.error('❌ 文件写入错误:', event.message)
  })

  logger.on('rateLimitExceeded', (event) => {
    console.warn('⚠️  日志限流触发:', event.message)
  })

  // 记录各种日志
  for (let i = 0; i < 100; i++) {
    if (i % 10 === 0) {
      logger.error('处理失败', { id: i, error: 'Unknown' })
    } else if (i % 5 === 0) {
      logger.warn('资源可用性低', { resource: 'memory' })
    } else if (i % 3 === 0) {
      logger.info(`处理请求 #${i}`)
    } else {
      logger.debug(`健康检查 #${i}`) // 这些会被过滤
    }
  }

  // 输出最终指标
  const metrics = logger.getMetrics()
  console.log(`
✅ 最终指标统计:
  - 总日志数: ${metrics.totalLogs}
  - 采样日志数: ${metrics.sampledLogs}
  - 过滤日志数: ${metrics.filteredLogs}
  - 丢弃日志数: ${metrics.droppedLogs}
  - 平均处理时间: ${metrics.avgProcessingTime.toFixed(3)}ms
  `)
}

/**
 * 运行所有示例
 */
export async function runAll() {
  console.log('🚀 开始运行 @chaeco/logger 高级特性示例\n')

  stackCacheExample()
  console.log()

  filterExample()
  console.log()

  metricsExample()
  console.log()

  await combinedExample()

  console.log('\n✅ 所有示例运行完成！')
}
