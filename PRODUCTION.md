# 生产环境配置指南

本文档提供了在生产环境中使用 `@chaeco/logger` 的最佳实践和推荐配置。

## 📋 生产环境检查清单

### 必需配置

- [ ] 设置合适的日志级别（推荐 `info` 或 `warn`）
- [ ] 启用文件输出并配置日志轮转
- [ ] 配置日志保留策略（maxAge、maxFiles）
- [ ] 禁用或限制 debug 级别日志
- [ ] 启用日志压缩（节省磁盘空间）
- [ ] 配置限流防止日志洪泛
- [ ] 设置错误监控和告警

### 推荐配置

- [ ] 启用日志采样（降低性能开销）
- [ ] 配置日志过滤（排除敏感信息）
- [ ] 设置性能监控
- [ ] 配置异步写入（提高性能）
- [ ] 实现日志备份策略

## 🔧 推荐配置模板

### Node.js 生产环境

```typescript
import { Logger } from '@chaeco/logger'

const logger = new Logger({
  level: 'info',
  name: 'production-app',
  
  // 文件输出配置
  file: {
    enabled: true,
    path: process.env.LOG_PATH || '/var/log/app',
    maxSize: '50mb',
    maxFiles: 100,
    maxAge: 30,           // 保留 30 天
    compress: true,       // 启用压缩
    writeMode: 'async',   // 异步写入（性能更好）
  },
  
  // 控制台输出
  console: {
    enabled: false,       // 生产环境禁用控制台（或仅在开发模式启用）
    colors: false,
    timestamp: true,
  },
  
  // 日志采样
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0.01,        // 1%
      info: 0.1,          // 10%
      warn: 1,            // 100%
      error: 1,           // 100%
      silent: 0,
    },
  },
  
  // 限流配置
  rateLimit: {
    enabled: true,
    windowSize: 10000,    // 10秒窗口
    maxLogsPerWindow: 5000,
    warnOnLimitExceeded: true,
  },
  
  // 日志过滤
  filter: {
    enabled: true,
    filters: [
      // 过滤健康检查日志
      (entry) => !entry.message.includes('/health'),
      // 过滤敏感信息
      (entry) => !entry.message.includes('password'),
    ],
  },
  
  // 错误处理
  errorHandling: {
    silent: true,         // 静默错误，不影响主应用
    fallbackToConsole: true,
    retryCount: 3,
    retryDelay: 100,
  },
})

// 监听错误事件
logger.on('error', (event) => {
  // 发送到错误监控服务（如 Sentry）
  console.error('Logger error:', event)
})

logger.on('rateLimitExceeded', (event) => {
  // 触发告警
  console.warn('Rate limit exceeded:', event)
})

export { logger }
```

### 微服务环境

```typescript
const logger = new Logger({
  level: process.env.LOG_LEVEL || 'info',
  name: process.env.SERVICE_NAME || 'microservice',
  
  file: {
    enabled: true,
    path: './logs',
    maxSize: '20mb',
    maxFiles: 50,
    maxAge: 7,            // 微服务日志保留7天
    compress: true,
  },
  
  // JSON 格式输出（便于日志收集系统解析）
  format: {
    json: true,
    jsonIndent: 0,        // 不缩进，节省空间
    timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
  },
  
  sampling: {
    enabled: true,
    rate: 0.1,            // 整体采样率 10%
  },
  
  rateLimit: {
    enabled: true,
    windowSize: 5000,
    maxLogsPerWindow: 1000,
  },
})
```

### Docker/Kubernetes 环境

```typescript
const logger = new Logger({
  level: 'info',
  name: process.env.POD_NAME || 'container',
  
  // 容器环境推荐输出到控制台，由容器运行时收集
  console: {
    enabled: true,
    colors: false,        // 禁用颜色（避免干扰日志收集）
    timestamp: true,
  },
  
  // 禁用文件输出（使用容器日志）
  file: {
    enabled: false,
  },
  
  // JSON 格式便于结构化日志解析
  format: {
    json: true,
    jsonIndent: 0,
  },
  
  sampling: {
    enabled: true,
    rate: 0.2,
  },
})
```

### 浏览器环境

```typescript
const logger = new Logger({
  level: 'warn',          // 生产环境只记录警告和错误
  name: 'web-app',
  
  console: {
    enabled: true,
    colors: true,
    timestamp: true,
  },
  
  // 使用 IndexedDB 存储
  file: {
    enabled: true,
    maxFiles: 100,
    maxAge: 7,            // 浏览器环境保留时间较短
  },
  
  // 严格限流（避免影响用户体验）
  rateLimit: {
    enabled: true,
    windowSize: 10000,
    maxLogsPerWindow: 200,
  },
  
  // 过滤敏感信息
  filter: {
    enabled: true,
    filters: [
      (entry) => {
        // 移除可能包含的敏感数据
        const sensitivePatterns = /token|password|secret|key/i
        return !sensitivePatterns.test(JSON.stringify(entry))
      },
    ],
  },
})
```

## 🎯 性能优化建议

### 1. 启用异步写入

```typescript
file: {
  writeMode: 'async',
}

async: {
  enabled: true,
  queueSize: 1000,
  batchSize: 100,
  flushInterval: 1000,
  overflowStrategy: 'drop',
}
```

### 2. 合理配置采样率

```typescript
sampling: {
  enabled: true,
  rateByLevel: {
    debug: 0.01,    // 高频日志采样更少
    info: 0.05,
    warn: 0.5,
    error: 1,       // 错误日志全部记录
  },
}
```

### 3. 日志轮转和压缩

```typescript
file: {
  maxSize: '50mb',    // 较大的文件减少轮转频率
  compress: true,     // 压缩旧日志节省空间
  maxAge: 30,         // 自动清理旧日志
}
```

## 🔍 监控和告警

### 监控关键指标

```typescript
// 定期检查性能指标
setInterval(() => {
  const metrics = logger.getMetrics()
  
  if (metrics.fileWriteErrors > 10) {
    // 告警：文件写入错误过多
    sendAlert('Logger file write errors', metrics)
  }
  
  if (metrics.droppedLogs > 1000) {
    // 告警：大量日志被限流丢弃
    sendAlert('High log drop rate', metrics)
  }
  
  // 重置指标
  logger.resetMetrics()
}, 60000) // 每分钟检查一次
```

### 错误事件监听

```typescript
logger.on('fileWriteError', (event) => {
  // 发送到监控系统
  sendToMonitoring({
    type: 'logger_error',
    error: event.error,
    timestamp: event.timestamp,
  })
})

logger.on('rateLimitExceeded', (event) => {
  // 记录限流事件
  metricsCollector.increment('logger.rate_limit_exceeded')
})
```

## 📊 日志级别使用指南

| 级别 | 使用场景 | 生产环境 | 开发环境 |
|------|----------|----------|----------|
| `debug` | 详细调试信息 | 采样 1% | 100% |
| `info` | 一般操作信息 | 采样 10% | 100% |
| `warn` | 潜在问题警告 | 100% | 100% |
| `error` | 错误和异常 | 100% | 100% |
| `silent` | 禁用所有日志 | - | - |

## 🔒 安全建议

1. **过滤敏感信息**
```typescript
filter: {
  enabled: true,
  filters: [
    (entry) => {
      // 检测并过滤敏感字段
      const sensitive = /password|token|secret|api[_-]?key/i
      const serialized = JSON.stringify(entry)
      return !sensitive.test(serialized)
    },
  ],
}
```

2. **限制日志文件权限**
```typescript
file: {
  fileMode: 0o600,  // 仅所有者可读写
  dirMode: 0o700,   // 仅所有者可访问
}
```

3. **定期清理日志**
```typescript
file: {
  maxAge: 30,       // 最多保留30天
  compress: true,   // 压缩旧日志
}
```

## 🚀 部署检查

部署前请确认：

1. [ ] 日志路径具有适当的写入权限
2. [ ] 磁盘空间足够存储日志文件
3. [ ] 日志轮转和清理配置正确
4. [ ] 监控和告警已配置
5. [ ] 敏感信息已过滤
6. [ ] 性能测试通过
7. [ ] 文档已更新

## 📞 故障排查

### 日志不写入文件

1. 检查文件路径权限
2. 检查磁盘空间
3. 查看错误事件：`logger.on('fileWriteError', handler)`

### 性能问题

1. 启用异步写入
2. 增加采样率
3. 降低日志级别
4. 启用限流

### 日志丢失

1. 检查采样配置
2. 检查限流配置
3. 查看 metrics.droppedLogs

## 📚 相关资源

- [日志最佳实践](https://12factor.net/logs)
- [结构化日志](https://www.structuredlogging.org/)
- [日志聚合工具](https://www.elastic.co/elk-stack)
