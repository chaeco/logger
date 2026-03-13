/**
 * @chaeco/logger — 高级功能示例
 *
 * 演示：异步批量写入、自定义格式化、JSON 输出、事件钩子、错误处理策略。
 */

import { Logger } from '../src/index'
import type { LogEntry } from '../src/core/types'

// ─── 1. 高吞吐异步写入 ───────────────────────────────────────────────────────

const asyncLogger = new Logger({
  name: 'async',
  level: 'info',
  file: {
    path: './logs',
    filename: 'async',
    maxSize: 50 * 1024 * 1024,
    maxFiles: 10,
  },
  async: {
    enabled: true,
    queueSize: 2000,
    batchSize: 200,
    flushInterval: 500,
    overflowStrategy: 'drop', // 队列满时丢弃，保护吞吐
  },
  console: { enabled: false },
})

for (let i = 0; i < 1000; i++) {
  asyncLogger.info(`batch message ${i}`, { index: i })
}

// ─── 2. JSON 格式输出（适合 ELK / Loki 采集）────────────────────────────────

const jsonLogger = new Logger({
  name: 'json',
  level: 'info',
  file: {
    path: './logs',
    filename: 'json',
  },
  format: {
    json: true,
    jsonIndent: 0,       // 单行 JSON，利于日志采集器解析
    includeName: true,
    includeStack: false, // 生产环境关闭调用栈（性能）
  },
  console: { enabled: false },
})

jsonLogger.info('用户登录', { userId: 'u-001', ip: '1.2.3.4' })
// 输出：{"timestamp":"...","level":"info","message":"用户登录","name":"json","data":{"userId":"u-001","ip":"1.2.3.4"}}

// ─── 3. 自定义格式化函数 ─────────────────────────────────────────────────────

function customFormatter(entry: LogEntry): string {
  const parts = [`[${entry.timestamp}]`, `[${entry.level.toUpperCase()}]`]
  if (entry.name) parts.push(`[${entry.name}]`)
  parts.push(entry.message)
  if (entry.data != null) parts.push(JSON.stringify(entry.data))
  return parts.join(' ')
}

const customLogger = new Logger({
  name: 'custom',
  level: 'debug',
  file: { path: './logs', filename: 'custom' },
  format: { enabled: true, formatter: customFormatter },
  console: { colors: false },
})

customLogger.info('自定义格式消息', { env: 'prod' })

// ─── 4. 事件钩子 ─────────────────────────────────────────────────────────────

const eventLogger = new Logger({
  name: 'events',
  level: 'debug',
  file: { path: './logs', filename: 'events' },
  errorHandling: { silent: true, fallbackToConsole: false },
})

// 监控级别变更（适合运维仪表盘）
eventLogger.on('levelChange', (e) => {
  console.log(`[监控] 日志级别变更: ${e.data?.oldLevel} → ${e.data?.newLevel}`)
})

// 监控文件写入失败（适合告警系统）
eventLogger.on('fileWriteError', (e) => {
  console.error(`[告警] 日志写入失败: ${e.message}`, e.error)
  // 在这里接入 Sentry / PagerDuty
})

eventLogger.setLevel('warn') // 触发 levelChange 事件

// ─── 5. 运行时 updateConfig ───────────────────────────────────────────────────

const dynamicLogger = new Logger({ name: 'dyn', file: { enabled: false } })

dynamicLogger.info('初始级别 info')

dynamicLogger.updateConfig({ level: 'debug' })
dynamicLogger.debug('现在可以看到 debug 了')

dynamicLogger.updateConfig({
  file: { enabled: true, path: './logs', filename: 'dynamic' },
})
dynamicLogger.info('文件写入已开启')

// ─── 6. 优雅关闭 ─────────────────────────────────────────────────────────────

async function shutdown() {
  // 确保异步队列中所有消息写入磁盘后再退出进程
  await asyncLogger.close()
  await jsonLogger.close()
  await customLogger.close()
  await eventLogger.close()
  await dynamicLogger.close()
  console.log('所有日志已落盘，进程安全退出')
}

shutdown().catch(console.error)
