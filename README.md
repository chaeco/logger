# @chaeco/logger

跨平台日志库，支持 Node.js 和浏览器环境。

## 特性

- ✅ 跨平台支持（Node.js + 浏览器）
- ✅ 5个日志级别（debug/info/warn/error/silent）
- ✅ 自动显示调用者文件和行号
- ✅ 文件自动分割（Node.js）
- ✅ IndexedDB 存储（浏览器）
- ✅ 日志采样、限流、过滤
- ✅ 完整的 TypeScript 支持

## 安装

```bash
npm install git+ssh://git@github.com:chaeco/logger.git
```

## 快速开始

### 基础使用

```typescript
import { logger } from '@chaeco/logger'

logger.info('应用启动')
logger.warn('警告信息')
logger.error('错误信息', { error: err })
logger.debug('调试信息')

// 完全禁用日志
logger.setLevel('silent')
```

### 自定义配置

```typescript
import { Logger } from '@chaeco/logger'

const logger = new Logger({
  level: 'info',              // debug | info | warn | error | silent
  name: 'app',
  file: {
    enabled: true,
    path: './logs',
    maxSize: '10m',
    maxFiles: 30
  },
  console: {
    enabled: true,
    colors: true,
    timestamp: true
  }
})
```

### 浏览器环境

```typescript
// 启用 IndexedDB 存储
logger.updateConfig({
  file: { enabled: true }
})

// 查询存储的日志
const logs = await logger.queryStoredLogs({ limit: 50 })

// 清除日志
await logger.clearStoredLogs()
```

## 日志级别

| 级别     | 说明         |
| -------- | ------------ |
| `debug`  | 调试信息     |
| `info`   | 一般信息     |
| `warn`   | 警告信息     |
| `error`  | 错误信息     |
| `silent` | 禁用所有日志 |

## 高级功能

### 日志采样

```typescript
logger.configureSampling({
  enabled: true,
  rateByLevel: {
    debug: 0.01,  // 1%
    info: 0.1,    // 10%
    error: 1      // 100%
  }
})
```

### 日志限流

```typescript
logger.configureRateLimit({
  enabled: true,
  windowSize: 1000,         // 1秒
  maxLogsPerWindow: 1000    // 最多1000条
})
```

### 日志过滤

```typescript
logger.configureFilter({
  enabled: true,
  filters: [
    (entry) => !entry.message.includes('healthcheck')
  ]
})
```

### 子 Logger

```typescript
const dbLogger = logger.child('database')
dbLogger.info('连接成功')  // 输出: [app:database] INFO 连接成功
```

### 事件监听

```typescript
logger.on('error', (event) => {
  console.error('日志错误:', event.message)
})

logger.on('rateLimitExceeded', (event) => {
  console.warn('触发限流')
})
```

### 性能监控

```typescript
const metrics = logger.getMetrics()
console.log(metrics.totalLogs)
console.log(metrics.avgProcessingTime)
```

## API 参考

### 核心方法

```typescript
// 日志记录
logger.debug(message, data?)
logger.info(message, data?)
logger.warn(message, data?)
logger.error(message, data?)

// 级别控制
logger.setLevel(level: LogLevel)
logger.getLevel(): LogLevel

// 配置
logger.updateConfig(options: Partial<LoggerOptions>)
logger.configureSampling(options: SamplingOptions)
logger.configureRateLimit(options: RateLimitOptions)
logger.configureFilter(options: FilterOptions)

// 子 Logger
logger.child(name: string): Logger

// 事件
logger.on(type: LoggerEventType, handler: LoggerEventHandler)
logger.off(type: LoggerEventType, handler: LoggerEventHandler)

// 监控
logger.getMetrics(): PerformanceMetrics
logger.resetMetrics()
```

### 浏览器专属

```typescript
// IndexedDB 操作
logger.queryStoredLogs(options?: {
  limit?: number
  offset?: number
  date?: string
}): Promise<any[]>

logger.clearStoredLogs(): Promise<void>
```

### 环境检测

```typescript
import { 
  isNodeEnvironment, 
  isBrowserEnvironment,
  currentEnvironment,
  detectEnvironment 
} from '@chaeco/logger'

if (isNodeEnvironment) {
  // Node.js 环境
}

if (isBrowserEnvironment) {
  // 浏览器环境
}
```

## 生产环境配置

### Node.js

```typescript
const logger = new Logger({
  level: 'info',
  file: {
    enabled: true,
    path: './logs',
    maxSize: '100m',
    maxFiles: 50
  },
  console: {
    enabled: false  // 生产环境关闭控制台
  },
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0.01,
      info: 0.1,
      warn: 1,
      error: 1
    }
  },
  rateLimit: {
    enabled: true,
    windowSize: 10000,
    maxLogsPerWindow: 5000
  }
})
```

### 浏览器

```typescript
const logger = new Logger({
  level: 'info',
  file: { enabled: true },  // 启用 IndexedDB
  console: { enabled: true },
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0.01,
      info: 0.05,
      warn: 1,
      error: 1
    }
  },
  rateLimit: {
    enabled: true,
    windowSize: 10000,
    maxLogsPerWindow: 200
  }
})
```

## 平台兼容性

| 功能           | Node.js | 浏览器 |
| -------------- | ------- | ------ |
| 控制台输出     | ✅      | ✅     |
| 文件写入       | ✅      | ❌     |
| IndexedDB 存储 | ❌      | ✅     |
| 日志采样       | ✅      | ✅     |
| 日志限流       | ✅      | ✅     |
| 日志过滤       | ✅      | ✅     |
| 性能监控       | ✅      | ✅     |
| 调用栈追踪     | ✅      | ✅     |
| 彩色输出       | ✅      | ⚠️     |

## 示例

查看 `examples/` 目录：

- [advanced-features.ts](./examples/advanced-features.ts) - 高级特性示例
- [browser-storage.ts](./examples/browser-storage.ts) - 浏览器存储示例

## 开发

```bash
npm install        # 安装依赖
npm run build      # 构建
npm run test       # 测试
npm run docs       # 生成文档
```

## 更新日志

### v1.0.0 (2025-12-21)

- 初始发布
- ✨ 跨平台支持（Node.js + 浏览器）
- ✨ 5 个日志级别（debug/info/warn/error/silent）
- ✨ 文件自动分割和 IndexedDB 存储
- ✨ 日志采样、限流、过滤
- ✨ 性能监控和事件系统
- ✨ 完整的 TypeScript 支持

## License

ISC
