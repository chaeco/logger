# 使用示例

本文档展示 `@chaeco/logger` 的常见用法。所有示例均可在 `examples/` 目录中找到可运行版本。

> **运行时要求**：仅支持 Node.js，不支持浏览器环境。

---

## 快速开始

```typescript
import { logger } from '@chaeco/logger'

logger.info('应用启动')
logger.warn('内存使用率偏高', { usage: '78%' })
logger.error('数据库连接失败', new Error('ECONNREFUSED'))
```

---

## 创建自定义 Logger

```typescript
import { Logger } from '@chaeco/logger'

const log = new Logger({
  name: 'app',
  level: 'debug',
  file: {
    path: './logs',
    filename: 'app',
    maxSize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 30,
    maxAge: 7,
    compress: true,
  },
  console: { enabled: true, colors: true, timestamp: true },
})

log.debug('调试模式已启用')
log.info('服务初始化完成', { port: 3000 })
```

---

## 子 Logger

子 Logger 继承父级的级别、文件配置、格式设置，名称格式为 `parent:child`。

```typescript
const dbLogger = log.child('db')
dbLogger.info('已连接到 PostgreSQL')   // 输出: [app:db] INFO ...

const httpLogger = log.child('http')
httpLogger.warn('响应超时', { url: '/api/data', ms: 3200 })
```

---

## 日志级别

支持 5 个级别，优先级递增：`debug` < `info` < `warn` < `error` < `silent`。

```typescript
// 运行时修改级别
log.setLevel('warn')    // debug/info 不再输出
log.setLevel('silent')  // 完全静默
log.setLevel('debug')   // 恢复最详细

// 获取当前级别
console.log(log.getLevel()) // 'debug'
```

---

## 参数形式

```typescript
// 无参数
log.info()

// 纯消息
log.info('用户登录')

// 消息 + 元数据
log.info('请求完成', { method: 'GET', url: '/api', status: 200 })

// Error 对象
log.error(new Error('未捕获异常'))

// 多参数（自动打包为数组）
log.debug('多字段调试', { a: 1 }, { b: 2 })
```

---

## 异步批量写入

适合高并发、高吞吐服务，显著降低 I/O 阻塞。

```typescript
const log = new Logger({
  name: 'server',
  file: { path: './logs', filename: 'server' },
  async: {
    enabled: true,
    queueSize: 2000,     // 队列容量
    batchSize: 200,      // 每批写入条数
    flushInterval: 500,  // 最长等待刷新时间（毫秒）
    overflowStrategy: 'drop', // 队列满时策略：drop | block | overflow
  },
})
```

---

## JSON 格式输出

适合 ELK、Loki、Datadog 等日志采集系统。

```typescript
const log = new Logger({
  file: { path: './logs', filename: 'json' },
  format: {
    json: true,
    jsonIndent: 0,       // 单行 JSON，利于采集器解析
    includeName: true,
    includeStack: false,
  },
})

log.info('用户登录', { userId: 'u-001' })
// 输出: {"timestamp":"...","level":"info","message":"用户登录","data":{"userId":"u-001"}}
```

---

## 自定义格式化函数

```typescript
import type { LogEntry } from '@chaeco/logger'

function myFormatter(entry: LogEntry): string {
  return `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.message}`
}

const log = new Logger({
  format: { enabled: true, formatter: myFormatter },
})
```

---

## 事件钩子

```typescript
// 监控级别变更
log.on('levelChange', (e) => {
  console.log(`级别变更: ${e.data?.oldLevel} → ${e.data?.newLevel}`)
})

// 监控文件写入失败（接入告警系统）
log.on('fileWriteError', (e) => {
  alerting.send({ title: '日志写入失败', message: e.message, error: e.error })
})

// 取消监听
const handler = (e: LoggerEvent) => console.log(e)
log.on('levelChange', handler)
log.off('levelChange', handler)
```

---

## 错误处理

```typescript
const log = new Logger({
  errorHandling: {
    silent: true,              // 抑制 stderr 输出
    fallbackToConsole: false,  // 写入失败时不降级到控制台
    onError: (err, ctx) => {
      // 接入外部告警（Sentry、PagerDuty 等）
      sentry.captureException(err, { extra: { context: ctx } })
    },
  },
})
```

---

## updateConfig 运行时重配

```typescript
log.updateConfig({ level: 'debug' })

log.updateConfig({
  console: { colors: false, timestamp: false },
})

// 动态开启文件写入（初始为仅控制台时）
log.updateConfig({
  file: { enabled: true, path: './logs', filename: 'runtime' },
})
```

---

## 优雅关闭

```typescript
process.on('SIGTERM', async () => {
  await log.close() // 刷新异步队列，确保所有日志落盘
  process.exit(0)
})
```
