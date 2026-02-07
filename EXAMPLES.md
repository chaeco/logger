# @chaeco/logger 完整使用示例

本文档提供 @chaeco/logger 的完整使用示例和最佳实践。

## 目录

- [基础用法](#基础用法)
- [高级特性](#高级特性)
- [生产环境配置](#生产环境配置)
- [错误处理](#错误处理)
- [性能优化](#性能优化)
- [监控和调试](#监控和调试)

## 基础用法

### 快速开始

\`\`\`typescript
import { Logger } from '@chaeco/logger'

// 创建 logger 实例
const logger = new Logger()

// 记录不同级别的日志
logger.debug('调试信息')
logger.info('普通信息')
logger.warn('警告信息')
logger.error('错误信息')
\`\`\`

### 带数据的日志

\`\`\`typescript
// 记录额外数据
logger.info('用户登录', {
  userId: '12345',
  username: 'john',
  ip: '192.168.1.1'
})

// 记录错误对象
try {
  throw new Error('Something went wrong')
} catch (error) {
  logger.error('处理请求失败', { error })
}
\`\`\`

### 配置文件输出

\`\`\`typescript
const logger = new Logger({
  file: {
    enabled: true,
    path: './logs',
    filename: 'app',
    maxSize: '10m',    // 单文件最大10MB
    maxFiles: 30,      // 最多保留30个文件
    maxAge: 30,        // 保留30天
  },
})
// 直接使用，首次写入时自动创建目录
logger.info('应用已启动')
```

### Electron 应用中使用

```typescript
import { Logger } from '@chaeco/logger'
import path from 'path'
import { app } from 'electron'

const logger = new Logger({
  name: 'electron-app',
  file: {
    enabled: true,
    // 使用应用数据目录
    path: path.join(app.getPath('userData'), 'logs'),
    maxSize: '10m',
    maxFiles: 30,
  },
})

// 直接使用，无需手动初始化
logger.info('Electron 应用已启动')\`\`\`

## 高级特性

### 1. 子 Logger

为不同模块创建子 logger：

\`\`\`typescript
// 主 logger
const appLogger = new Logger({ name: 'app' })

// 为不同模块创建子 logger
const dbLogger = appLogger.child('database')
const apiLogger = appLogger.child('api')
const authLogger = appLogger.child('auth')

// 使用子 logger
dbLogger.info('连接数据库')
apiLogger.info('API请求', { path: '/users' })
authLogger.warn('登录失败', { username: 'john' })
\`\`\`

### 2. 动态日志级别

根据环境或运行时条件调整日志级别：

\`\`\`typescript
const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug'
})

// 运行时修改级别
logger.setLevel('debug') // 临时启用调试日志
\`\`\`

### 3. 自定义格式化

\`\`\`typescript
const logger = new Logger({
  console: { enabled: true, colors: false },
  format: {
    enabled: true,
    formatter: (entry) => {
      // 自定义格式
      return \`[\${entry.level.toUpperCase()}] \${entry.message}\`
    },
  },
})
\`\`\`

### 4. JSON 格式输出

适合日志聚合系统（如 ELK、Splunk）：

\`\`\`typescript
const logger = new Logger({
  format: {
    json: true,
    jsonIndent: 0, // 生产环境建议为0
  },
})

logger.info('用户操作', {
  action: 'login',
  userId: '12345',
  timestamp: Date.now()
})

// 输出:
// {"timestamp":"2025-12-21T10:00:00.000Z","level":"info","message":"用户操作","data":{"action":"login","userId":"12345","timestamp":1703156400000}}
\`\`\`

### 5. 采样

对于高频日志，使用采样减少日志量：

\`\`\`typescript
const logger = new Logger()

// 配置采样
logger.configureSampling({
  enabled: true,
  rate: 0.1, // 只记录10%的日志
})

// 不同级别的采样率
logger.configureSampling({
  enabled: true,
  rateByLevel: {
    debug: 0.01,  // debug 只记录1%
    info: 0.1,    // info 记录10%
    warn: 0.5,    // warn 记录50%
    error: 1,     // error 全部记录
    silent: 0,
  },
})
\`\`\`

### 6. 限流

防止日志洪水：

\`\`\`typescript
logger.configureRateLimit({
  enabled: true,
  windowSize: 1000,        // 1秒时间窗口
  maxLogsPerWindow: 1000,  // 每秒最多1000条
  warnOnLimitExceeded: true, // 超限时发出警告
})

// 监听限流事件
logger.on('rateLimitExceeded', (dropped) => {
  console.warn(\`已丢弃 \${dropped} 条日志\`)
})
\`\`\`

### 7. 日志过滤

根据条件过滤日志：

\`\`\`typescript
logger.configureFilter({
  enabled: true,
  mode: 'all', // 或 'any'
  filters: [
    // 过滤掉健康检查日志
    (entry) => !entry.message.includes('health check'),
    // 过滤掉特定用户的日志
    (entry) => entry.data?.userId !== 'test-user',
  ],
})
\`\`\`

### 8. 事件监听

监听 logger 事件：

\`\`\`typescript
logger.on('levelChange', (oldLevel, newLevel) => {
  console.log(\`日志级别从 \${oldLevel} 变更为 \${newLevel}\`)
})

logger.on('rateLimitExceeded', (count) => {
  console.warn(\`已丢弃 \${count} 条日志\`)
})

logger.on('fileWriteError', (error) => {
  console.error('文件写入失败:', error)
})
\`\`\`

## 生产环境配置

### Web 应用服务器

\`\`\`typescript
import { Logger } from '@chaeco/logger'

const logger = new Logger({
  name: 'web-server',
  level: 'info',

  // 禁用控制台输出（在容器环境中）
  console: {
    enabled: false,
  },

  // 配置文件输出
  file: {
    enabled: true,
    path: process.env.LOG_PATH || '/var/log/app',
    filename: 'web-server',
    maxSize: '50m',
    maxFiles: 14,
    maxAge: 14,
    compress: true,
    writeMode: 'async',
  },

  // 异步写入配置
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 200,
    flushInterval: 2000,
  },

  // JSON 格式便于日志聚合
  format: {
    json: true,
    jsonIndent: 0,
  },

  // 采样配置
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0,
      info: 0.1,
      warn: 1,
      error: 1,
      silent: 0,
    },
  },

  // 限流配置
  rateLimit: {
    enabled: true,
    windowSize: 1000,
    maxLogsPerWindow: 5000,
  },
})

// 优雅关闭
process.on('SIGINT', async () => {
  console.log('正在关闭...')
  await logger.close()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await logger.close()
  process.exit(0)
})

export default logger
\`\`\`

### 微服务

\`\`\`typescript
import { Logger } from '@chaeco/logger'

class ServiceLogger {
  private logger: Logger

  constructor(serviceName: string) {
    this.logger = new Logger({
      name: serviceName,
      level: process.env.LOG_LEVEL || 'info',

      console: {
        enabled: process.env.NODE_ENV !== 'production',
        colors: true,
      },

      file: {
        enabled: true,
        path: \`/var/log/\${serviceName}\`,
        filename: serviceName,
        maxSize: '20m',
        maxFiles: 7,
        compress: true,
        writeMode: 'async',
      },

      async: {
        enabled: true,
        queueSize: 2000,
      },

      format: {
        json: true,
        jsonIndent: 0,
      },
    })
  }

  // 结构化日志方法
  logRequest(method: string, path: string, statusCode: number, duration: number) {
    this.logger.info('HTTP请求', {
      type: 'http_request',
      method,
      path,
      statusCode,
      duration,
      timestamp: Date.now(),
    })
  }

  logError(error: Error, context?: any) {
    this.logger.error('服务错误', {
      type: 'service_error',
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
      context,
      timestamp: Date.now(),
    })
  }

  async close() {
    await this.logger.close()
  }
}

export default ServiceLogger
\`\`\`

### CLI 工具

\`\`\`typescript
const logger = new Logger({
  name: 'cli-tool',
  level: 'info',

  // CLI 工具通常只需要控制台输出
  console: {
    enabled: true,
    colors: true,
    timestamp: false, // CLI 工具不需要时间戳
  },

  file: {
    enabled: false, // 不需要文件输出
  },
})

// 进度提示
logger.info('开始处理...')
logger.info('✓ 步骤 1 完成')
logger.info('✓ 步骤 2 完成')
logger.info('✓ 全部完成!')
\`\`\`

## 错误处理

### 捕获和记录错误

\`\`\`typescript
const logger = new Logger({
  errorHandling: {
    silent: false, // 不静默错误
    retryCount: 3,
    retryDelay: 100,
    fallbackToConsole: true, // 文件写入失败时回退到控制台
    onError: (error, context) => {
      // 自定义错误处理
      console.error('Logger error:', error)
      if (context) {
        console.error('Context:', context)
      }
    },
  },
})

// 记录带堆栈跟踪的错误
try {
  throw new Error('Something went wrong')
} catch (error) {
  logger.error('操作失败', {
    error: error instanceof Error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
    } : error
  })
}
\`\`\`

### 处理异步错误

\`\`\`typescript
// 捕获未处理的 Promise 拒绝
process.on('unhandledRejection', (reason, promise) => {
  logger.error('未处理的Promise拒绝', { reason, promise })
})

// 捕获未捕获的异常
process.on('uncaughtException', (error) => {
  logger.error('未捕获的异常', { error })
  process.exit(1)
})
\`\`\`

## 性能优化

### 使用异步写入

\`\`\`typescript
const logger = new Logger({
  file: {
    writeMode: 'async',
  },
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 200,
    flushInterval: 1000,
  },
})

// 高频日志写入
for (let i = 0; i < 10000; i++) {
  logger.info(\`日志 \${i}\`)
}

// 确保刷新队列
await logger.close()
\`\`\`

### 条件日志

\`\`\`typescript
// 只在 debug 级别时才执行昂贵的操作
if (logger.getLevel() === 'debug') {
  const expensiveData = computeExpensiveData()
  logger.debug('调试数据', expensiveData)
}
\`\`\`

## 监控和调试

### 性能指标

\`\`\`typescript
const logger = new Logger()

// 记录一些日志
logger.info('测试1')
logger.info('测试2')
logger.error('错误')

// 获取性能指标
const metrics = logger.getMetrics()
console.log('性能指标:', {
  totalLogs: metrics.totalLogs,       // 总日志数
  droppedLogs: metrics.droppedLogs,   // 丢弃的日志数
  sampledLogs: metrics.sampledLogs,   // 被采样的日志数
  filteredLogs: metrics.filteredLogs, // 被过滤的日志数
  fileWrites: metrics.fileWrites,     // 文件写入次数
  fileWriteErrors: metrics.fileWriteErrors, // 写入错误次数
  avgProcessingTime: metrics.avgProcessingTime, // 平均处理时间
})

// 重置指标
logger.resetMetrics()
\`\`\`

### 调试模式

\`\`\`typescript
// 开发环境启用详细日志
if (process.env.NODE_ENV === 'development') {
  const logger = new Logger({
    level: 'debug',
    console: {
      enabled: true,
      colors: true,
      timestamp: true,
    },
    file: {
      enabled: true,
      path: './logs/debug',
    },
  })
}
\`\`\`

## 完整示例：Express 应用

\`\`\`typescript
import express from 'express'
import { Logger } from '@chaeco/logger'

// 创建 logger
const logger = new Logger({
  name: 'express-app',
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  console: { enabled: true, colors: true },
  file: {
    enabled: true,
    path: './logs',
    maxSize: '10m',
    maxFiles: 30,
    writeMode: 'async',
  },
  async: { enabled: true },
})

const app = express()

// 请求日志中间件
app.use((req, res, next) => {
  const start = Date.now()

  res.on('finish', () => {
    const duration = Date.now() - start
    logger.info('HTTP请求', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration,
      ip: req.ip,
    })
  })

  next()
})

// 错误处理中间件
app.use((err: Error, req: express.Request, res: express.Response, next: express.NextFunction) => {
  logger.error('请求处理错误', {
    error: {
      name: err.name,
      message: err.message,
      stack: err.stack,
    },
    method: req.method,
    path: req.path,
  })

  res.status(500).json({ error: 'Internal Server Error' })
})

// 启动服务器
const port = 3000
app.listen(port, () => {
  logger.info('服务器已启动', { port })
})

// 优雅关闭
process.on('SIGTERM', async () => {
  logger.info('收到SIGTERM信号，正在关闭...')
  await logger.close()
  process.exit(0)
})
\`\`\`

## 更多资源

- [README](./README.md) - 完整文档
- [API 参考](./README.md#api-参考)
- [性能优化指南](./PERFORMANCE.md)
- [生产环境指南](./PRODUCTION.md)
- [示例代码](./examples/)
- [测试用例](./tests/)

## 贡献

欢迎提交 Issue 和 Pull Request！
