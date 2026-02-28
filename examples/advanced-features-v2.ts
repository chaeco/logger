/**
 * 高级功能示例：异步写入、自定义格式化、错误重试
 * 演示三个核心高级功能的使用方法
 */

import { Logger } from '../src/logger'
import { LogEntry } from '../src/types'

console.log('=== 高级功能演示 ===\n')

// ========================================
// 1. 异步写入队列（提升性能）
// ========================================
console.log('1. 异步写入队列示例：')
const asyncLogger = new Logger({
  level: 'info',
  name: 'async-logger',
  file: {
    enabled: true,
    path: './logs',
    filename: 'async-test',
  },
  async: {
    enabled: true,
    queueSize: 1000,        // 队列最大容量
    batchSize: 100,         // 每批次写入100条
    flushInterval: 1000,    // 每秒自动刷新
    overflowStrategy: 'drop', // 队列满时丢弃新日志
  },
})

// 模拟高频日志写入
console.log('   写入1000条日志（异步模式）...')
const startTime = Date.now()
for (let i = 0; i < 1000; i++) {
  asyncLogger.info(`异步日志消息 #${i}`)
}
const asyncTime = Date.now() - startTime
console.log(`   ✓ 完成，耗时: ${asyncTime}ms`)
console.log(`   队列状态:`, (asyncLogger as any).fileManager?.getQueueStatus())

// ========================================
// 2. 自定义格式化（灵活性）
// ========================================
console.log('\n2. 自定义格式化示例：')

// 2.1 JSON 格式输出
const jsonLogger = new Logger({
  level: 'info',
  name: 'json-logger',
  console: { enabled: false },
  file: {
    enabled: true,
    path: './logs',
    filename: 'json-format',
  },
  format: {
    json: true,
    jsonIndent: 2,  // 美化输出
  },
})

console.log('   2.1 JSON 格式：')
jsonLogger.info('用户登录', { userId: 123, ip: '192.168.1.1' })
console.log('   ✓ 已写入 JSON 格式日志')

// 2.2 自定义格式化函数
const customLogger = new Logger({
  level: 'info',
  name: 'custom-logger',
  console: { enabled: false },
  file: {
    enabled: true,
    path: './logs',
    filename: 'custom-format',
  },
  format: {
    enabled: true,
    formatter: (entry: LogEntry) => {
      // 自定义格式：[时间] 级别 | 消息 | 数据
      const parts = [
        `[${entry.timestamp}]`,
        entry.level.toUpperCase(),
        '|',
        entry.message,
      ]
      if (entry.data) {
        parts.push('|', JSON.stringify(entry.data))
      }
      return parts.join(' ')
    },
  },
})

console.log('   2.2 自定义格式化函数：')
customLogger.info('订单创建', { orderId: 'ORD-001', amount: 99.99 })
console.log('   ✓ 已使用自定义格式化函数')

// 2.3 紧凑 JSON 格式（生产环境推荐）
const compactLogger = new Logger({
  level: 'info',
  name: 'compact-logger',
  console: { enabled: false },
  file: {
    enabled: true,
    path: './logs',
    filename: 'compact-json',
  },
  format: {
    json: true,
    jsonIndent: 0,  // 无缩进，节省空间
  },
})

console.log('   2.3 紧凑 JSON 格式（适合日志收集）：')
compactLogger.info('API请求', {
  method: 'POST',
  url: '/api/users',
  status: 200,
  duration: 45,
})
console.log('   ✓ 已写入紧凑 JSON 日志')

// ========================================
// 3. 错误重试机制（可靠性）
// ========================================
console.log('\n3. 错误处理和重试机制示例：')

// 3.1 静默错误处理
const silentLogger = new Logger({
  level: 'info',
  name: 'silent-logger',
  file: {
    enabled: true,
    path: '/invalid/path/that/does/not/exist', // 故意使用无效路径
    filename: 'test',
    retryCount: 3,             // 重试3次
    retryDelay: 100,           // 每次重试延迟100ms
  },
  errorHandling: {
    silent: true,              // 静默错误，不抛出异常
    fallbackToConsole: true,   // 失败时降级到控制台
  },
})

console.log('   3.1 静默错误处理（写入会失败但不会崩溃）：')
silentLogger.info('这条日志会写入失败，但应用不会崩溃')
console.log('   ✓ 错误已静默处理')

// 3.2 自定义错误处理器
let errorCount = 0
const customErrorLogger = new Logger({
  level: 'info',
  name: 'custom-error-logger',
  file: {
    enabled: true,
    path: './logs',
    filename: 'error-test',
  },
  file: {
    enabled: true,
    path: './logs',
    filename: 'error-test',
    retryCount: 3,
    retryDelay: 50,
  },
  errorHandling: {
    silent: true,
    onError: (error: Error, context: string) => {
      errorCount++
      console.log(`   → 捕获到错误 #${errorCount}:`, error.message, `(上下文: ${context})`)
    },
  },
})

console.log('   3.2 自定义错误处理器：')
customErrorLogger.info('正常日志消息')

// 3.3 监听错误事件
const eventLogger = new Logger({
  level: 'info',
  name: 'event-logger',
  file: {
    enabled: true,
    path: './logs',
    filename: 'event-test',
  },
})

eventLogger.on('fileWriteError', (event) => {
  console.log(`   → 文件写入错误事件:`, event.message)
})

console.log('   3.3 错误事件监听：')
eventLogger.info('测试事件监听')
console.log('   ✓ 已配置错误事件监听器')

// ========================================
// 综合示例：组合使用所有功能
// ========================================
console.log('\n4. 综合示例（组合使用）：')

const productionLogger = new Logger({
  level: 'info',
  name: 'production',
  file: {
    enabled: true,
    path: './logs',
    filename: 'production',
    maxSize: 10 * 1024 * 1024,
    maxFiles: 50,
    maxAge: 30,
    compress: true,
    retryCount: 3,
    retryDelay: 100,
  },
  async: {
    enabled: true,
    queueSize: 1000,
    batchSize: 100,
    flushInterval: 1000,
    overflowStrategy: 'overflow',
  },
  format: {
    json: true,
    jsonIndent: 0,
    includeStack: true,
  },
  errorHandling: {
    silent: true,
    fallbackToConsole: true,
    onError: (error, context) => {
      // 发送到监控系统
      console.error(`[Monitor] Logger error in ${context}:`, error.message)
    },
  },
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0.01,  // 调试日志采样1%
      info: 0.1,    // 信息日志采样10%
      warn: 1,      // 警告日志全部记录
      error: 1,     // 错误日志全部记录
      silent: 0,
    },
  },
  rateLimit: {
    enabled: true,
    windowSize: 10000,
    maxLogsPerWindow: 5000,
  },
})

console.log('   生产环境配置（异步写入 + JSON格式 + 错误处理）：')
productionLogger.info('应用启动', {
  version: '1.0.0',
  environment: 'production',
  timestamp: Date.now(),
})
productionLogger.warn('磁盘空间不足', { available: '100MB', threshold: '500MB' })
productionLogger.error('数据库连接失败', { host: 'localhost', port: 5432 })

console.log('   ✓ 已记录生产环境日志')

// ========================================
// 性能对比
// ========================================
console.log('\n5. 性能对比：')

// 同步写入
const syncLogger = new Logger({
  level: 'info',
  console: { enabled: false },
  file: {
    enabled: true,
    path: './logs',
    filename: 'sync-perf',
  },
})

console.log('   同步写入 500 条日志...')
const syncStart = Date.now()
for (let i = 0; i < 500; i++) {
  syncLogger.info(`同步日志 #${i}`)
}
const syncDuration = Date.now() - syncStart

// 异步写入
const asyncPerfLogger = new Logger({
  level: 'info',
  console: { enabled: false },
  file: {
    enabled: true,
    path: './logs',
    filename: 'async-perf',
  },
  async: {
    enabled: true,
    queueSize: 1000,
    batchSize: 100,
    flushInterval: 1000,
  },
})

console.log('   异步写入 500 条日志...')
const asyncStart = Date.now()
for (let i = 0; i < 500; i++) {
  asyncPerfLogger.info(`异步日志 #${i}`)
}
const asyncDuration = Date.now() - asyncStart

console.log(`\n   性能对比结果：`)
console.log(`   - 同步写入: ${syncDuration}ms`)
console.log(`   - 异步写入: ${asyncDuration}ms`)
console.log(`   - 性能提升: ${((syncDuration - asyncDuration) / syncDuration * 100).toFixed(1)}%`)

// 清理：等待异步队列刷新完成
setTimeout(async () => {
  await (asyncLogger as any).fileManager?.close()
  await (asyncPerfLogger as any).fileManager?.close()
  console.log('\n✓ 所有异步操作已完成')
}, 2000)

console.log('\n=== 演示完成 ===')
console.log('查看 ./logs 目录以查看生成的日志文件')
