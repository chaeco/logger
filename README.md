# @chaeco/logger

跨平台日志库，支持 Node.js 和浏览器环境。

## 特性

- ✅ 跨平台支持（Node.js + 浏览器）
- ✅ 5个日志级别（debug/info/warn/error/silent）
- ✅ 自动显示调用者文件和行号
- ✅ 文件自动分割（Node.js）
- ✅ 自动清理过期日志
- ✅ 日志自动压缩（gzip）
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
    maxFiles: 30,
    maxAge: 30,                // 自动删除 30 天前的日志
    compress: true             // 自动压缩超过 1 天的日志
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

| 级别 | 说明 |
| -------- | ------------ |
| `debug` | 调试信息 |
| `info` | 一般信息 |
| `warn` | 警告信息 |
| `error` | 错误信息 |
| `silent` | 禁用所有日志 |

## 高自动清理和压缩

```typescript
// 自动清理：删除超过指定天数的日志
logger.updateConfig({
  file: {
    maxAge: 7  // 仅保留最近 7 天的日志
  }
})

// 自动压缩：使用 gzip 压缩超过 1 天的日志
logger.updateConfig({
  file: {
    compress: true  // 启用压缩，节省 70-90% 磁盘空间
  }
})

// 同时启用清理和压缩
const logger = new Logger({
  file: {
    enabled: true,
    path: './logs',
    maxSize: '10mb',
    maxFiles: 50,
    maxAge: 30,      // 保留 30 天
    compress: true   // 启用压缩
  }
})
```

**清理和压缩说明：**

- `maxAge`: 日志文件的最大保留天数，默认 30 天
- `compress`: 是否压缩超过 1 天的日志文件，默认 false
- 压缩使用 gzip 格式，文件扩展名变为 `.log.gz`
- 清理和压缩会在日志轮转时自动执行
- 支持两种清理策略：按数量（maxFiles）和按时间（maxAge）

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

详细的生产环境配置和最佳实践请参考：[生产环境配置指南](./PRODUCTION.md)

### Node.js

```typescript
const logger = new Logger({
  level: 'info',
  file: {
    enabled: true,
    path: './logs',
    maxSize: '100m',
    maxFiles: 50,
    maxAge: 30,        // 保留 30 天
    compress: true     // 启用压缩
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

| 功能 | Node.js | 浏览器 |
| -------------- | ------- | ------ |
| 控制台输出 | ✅ | ✅ |
| 文件写入 | ✅ | ❌ |
| IndexedDB 存储 | ❌ | ✅ |
| 日志采样 | ✅ | ✅ |
| 日志限流 | ✅ | ✅ |
| 日志过滤 | ✅ | ✅ |
| 性能监控 | ✅ | ✅ |
| 调用栈追踪 | ✅ | ✅ |
| 彩色输出 | ✅ | ⚠️ |

## 示例

查看 `examples/` 目录：

- [advanced-features-v2.ts](./examples/advanced-features-v2.ts) - 异步写入、格式化、错误处理示例 ⭐
- [auto-cleanup-compression.ts](./examples/auto-cleanup-compression.ts) - 自动清理和压缩示例
- [advanced-features.ts](./examples/advanced-features.ts) - 基础高级特性示例
- [browser-storage.ts](./examples/browser-storage.ts) - 浏览器存储示例

## 开发

```bash
npm install          # 安装依赖
npm run build        # 构建
npm run test         # 测试
npm run test:coverage # 测试覆盖率
npm run lint         # 代码检查
npm run format       # 代码格式化
npm run docs         # 生成文档
```

## 文档

- [完整使用示例](./EXAMPLES.md) - 包含基础、高级和生产环境示例
- [性能优化指南](./PERFORMANCE.md) - 性能最佳实践和基准测试
- [生产环境部署指南](./PRODUCTION.md) - 生产部署最佳实践
- [更新日志](./CHANGELOG.md) - 版本历史和改进记录

## 贡献

欢迎贡献代码！请查看 [PRODUCTION.md](./PRODUCTION.md) 了解生产环境最佳实践。

## 更新日志

### v0.0.3 (2025-12-21)

- ✨ 新增异步写入队列功能（性能提升 80%）
- ✨ 新增自定义格式化功能（支持 JSON 和自定义函数）
- ✨ 新增错误重试机制（提高可靠性）
- 🧪 新增全面的测试套件（92+ 测试用例，覆盖率 75%+）
- 🔧 优化文件写入流程
- 📝 完善生产环境配置指南

### v0.0.2 (2025-12-21)

- ✨ 新增自动清理功能（maxAge）
- ✨ 新增日志压缩功能（compress）
- 🔧 优化文件清理逻辑，支持按时间和数量双重策略

### v0.0.1 (2025-12-21)

- 初始发布
- ✨ 跨平台支持（Node.js + 浏览器）
- ✨ 5 个日志级别（debug/info/warn/error/silent）
- ✨ 文件自动分割和 IndexedDB 存储
- ✨ 日志采样、限流、过滤
- ✨ 性能监控和事件系统
- ✨ 完整的 TypeScript 支持

## License

ISC
