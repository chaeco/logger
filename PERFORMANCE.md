# 性能优化指南

本文档提供 @chaeco/logger 的性能最佳实践和优化建议。

## 📊 性能基准

根据我们的基准测试，@chaeco/logger 在典型场景下的性能表现如下：

### 同步 vs 异步写入

- **同步写入**: ~5,000-10,000 logs/sec
- **异步写入**: ~20,000-50,000 logs/sec (提升 80%+)

### 格式化性能

- **纯文本**: ~100,000+ logs/sec
- **JSON格式**: ~50,000+ logs/sec

### 内存占用

- **50,000 logs**: ~180-200 MB
- **平均单条**: ~3-4 KB

## 🚀 最佳实践

### 1. 使用异步写入模式

对于高吞吐量场景，强烈推荐使用异步写入模式：

\`\`\`typescript
const logger = new Logger({
  file: {
    enabled: true,
    path: './logs',
    writeMode: 'async', // 使用异步模式
  },
  async: {
    enabled: true,
    queueSize: 2000,      // 队列大小
    batchSize: 100,       // 批次大小
    flushInterval: 1000,  // 刷新间隔(ms)
  },
})
\`\`\`

**优势:**

- 显著提升写入性能 (80%+)
- 不阻塞主线程
- 自动批量写入

**注意事项:**

- 程序退出时确保调用 `await logger.close()` 以刷新队列
- 内存占用会略高于同步模式

### 2. 合理配置日志级别

根据环境设置不同的日志级别：

\`\`\`typescript
// 生产环境
const logger = new Logger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
})
\`\`\`

**收益:**

- 减少不必要的日志输出
- 降低 I/O 开销
- 提高应用性能

### 3. 使用采样降低日志量

对于高频日志，使用采样可以显著减少日志量：

\`\`\`typescript
logger.configureSampling({
  enabled: true,
  rate: 0.1, // 只记录 10% 的日志
  rateByLevel: {
    debug: 0.01, // debug 只记录 1%
    info: 0.1,   // info 记录 10%
    warn: 0.5,   // warn 记录 50%
    error: 1,    // error 全部记录
  },
})
\`\`\`

**收益:**

- 减少 90% 或更多的日志量
- 仍然保留统计学意义上的样本
- 显著降低磁盘 I/O

### 4. 配置限流防止日志爆炸

\`\`\`typescript
logger.configureRateLimit({
  enabled: true,
  windowSize: 1000,       // 1秒时间窗口
  maxLogsPerWindow: 1000, // 每秒最多1000条
  warnOnLimitExceeded: true,
})
\`\`\`

**收益:**

- 防止日志洪水攻击
- 保护系统资源
- 提高稳定性

### 5. 禁用不需要的输出

如果只需要文件输出，禁用控制台：

\`\`\`typescript
const logger = new Logger({
  console: { enabled: false }, // 禁用控制台输出
  file: { enabled: true },
})
\`\`\`

**收益:**

- 减少终端渲染开销
- 降低CPU使用
- 在容器环境中特别有效

### 6. 使用合适的文件轮转策略

\`\`\`typescript
const logger = new Logger({
  file: {
    enabled: true,
    path: './logs',
    maxSize: '10m',  // 文件大小限制
    maxFiles: 30,    // 最多保留30个文件
    maxAge: 30,      // 保留30天
    compress: true,  // 压缩旧文件
  },
})
\`\`\`

**优势:**

- 自动管理磁盘空间
- 压缩可节省 60-80% 存储
- 避免单个文件过大影响性能

### 7. 生产环境优化配置示例

\`\`\`typescript
const logger = new Logger({
  level: 'info',
  console: {
    enabled: false, // 生产环境禁用控制台
  },
  file: {
    enabled: true,
    path: process.env.LOG_PATH || '/var/log/app',
    maxSize: '50m',
    maxFiles: 14,
    maxAge: 14,
    compress: true,
    writeMode: 'async',
  },
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 200,
    flushInterval: 2000,
  },
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0,    // 完全禁用 debug
      info: 0.1,   // 10% info
      warn: 1,     // 全部 warn
      error: 1,    // 全部 error
    },
  },
  rateLimit: {
    enabled: true,
    windowSize: 1000,
    maxLogsPerWindow: 5000,
  },
})
\`\`\`

## 📈 性能监控

使用内置的 metrics 监控日志性能：

\`\`\`typescript
const metrics = logger.getMetrics()
console.log('Logger Performance:', {
  totalLogs: metrics.totalLogs,
  droppedLogs: metrics.droppedLogs,
  sampledLogs: metrics.sampledLogs,
  fileWrites: metrics.fileWrites,
  fileWriteErrors: metrics.fileWriteErrors,
  avgProcessingTime: metrics.avgProcessingTime,
})
\`\`\`

## 🔍 故障排查

### 问题: 日志丢失

**可能原因:**

- 进程意外终止，异步队列未刷新
- 达到限流阈值

**解决方案:**
\`\`\`typescript
// 1. 确保正确关闭
process.on('SIGINT', async () => {
  await logger.close()
  process.exit(0)
})

// 2. 监听丢弃事件
logger.on('dropped', (count) => {
  console.warn(\`\${count} logs dropped\`)
})
\`\`\`

### 问题: 内存占用过高

**可能原因:**

- 异步队列设置过大
- 日志消息过大

**解决方案:**
\`\`\`typescript
// 1. 减小队列大小
async: {
  queueSize: 1000, // 默认是1000
}

// 2. 使用采样
sampling: {
  enabled: true,
  rate: 0.1,
}
\`\`\`

### 问题: 磁盘占用过高

**可能原因:**

- 文件轮转配置不当
- 未启用压缩

**解决方案:**
\`\`\`typescript
file: {
  maxSize: '10m',   // 限制单文件大小
  maxFiles: 30,     // 限制文件数量
  maxAge: 7,        // 限制保留天数
  compress: true,   // 启用压缩
}
\`\`\`

## 🎯 推荐配置模板

### 开发环境

\`\`\`typescript
const logger = new Logger({
  level: 'debug',
  console: { enabled: true, colors: true },
  file: { enabled: true, path: './logs' },
})
\`\`\`

### 测试环境

\`\`\`typescript
const logger = new Logger({
  level: 'info',
  console: { enabled: true },
  file: {
    enabled: true,
    path: './logs',
    maxSize: '10m',
    maxFiles: 5,
  },
})
\`\`\`

### 生产环境

\`\`\`typescript
const logger = new Logger({
  level: 'warn',
  console: { enabled: false },
  file: {
    enabled: true,
    path: '/var/log/app',
    maxSize: '50m',
    maxFiles: 14,
    maxAge: 14,
    compress: true,
    writeMode: 'async',
  },
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 200,
  },
  sampling: {
    enabled: true,
    rateByLevel: {
      debug: 0,
      info: 0.1,
      warn: 1,
      error: 1,
    },
  },
  rateLimit: {
    enabled: true,
    maxLogsPerWindow: 5000,
  },
})
\`\`\`

## 📚 相关资源

- [完整 API 文档](./README.md#api-参考)
- [完整使用示例](./EXAMPLES.md)
- [生产环境部署指南](./PRODUCTION.md)
- [示例代码](./examples/)
- [测试用例](./tests/)
- [Benchmark 测试](./tests/performance.test.ts)

## 🤝 贡献

欢迎提交性能优化建议和 PR！
