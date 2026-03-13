# 生产环境部署指南

> **运行时要求**：仅支持 Node.js，不支持浏览器环境。

---

## 推荐配置

### 标准 Web 服务

```typescript
import { Logger } from '@chaeco/logger'

const log = new Logger({
  name: 'app',
  level: process.env.LOG_LEVEL as any ?? 'info',
  file: {
    path: process.env.LOG_PATH ?? './logs',
    filename: 'app',
    maxSize: 100 * 1024 * 1024, // 100 MB
    maxFiles: 14,               // 保留 14 个文件
    maxAge: 30,                 // 30 天自动清理
    compress: true,             // 压缩非当日日志
  },
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 500,
    flushInterval: 1000,
    overflowStrategy: 'drop',
  },
  console: {
    enabled: process.env.NODE_ENV !== 'production',
    colors: true,
    timestamp: true,
  },
  errorHandling: {
    silent: true,
    fallbackToConsole: false,
    onError: (err, ctx) => externalAlert(err, ctx),
  },
})
```

### 高频微服务

```typescript
const log = new Logger({
  name: 'svc',
  level: 'warn',
  file: {
    path: './logs',
    filename: 'svc',
    maxSize: 200 * 1024 * 1024,
    maxFiles: 7,
    compress: true,
  },
  async: {
    enabled: true,
    queueSize: 10000,
    batchSize: 1000,
    flushInterval: 500,
    overflowStrategy: 'drop', // 极端吞吐场景优先保护服务
  },
  console: { enabled: false },
  format: {
    json: true,       // 结构化日志，便于采集
    jsonIndent: 0,
    includeStack: false,
  },
})
```

---

## 文件管理策略

| 参数 | 说明 | 推荐值 |
|------|------|--------|
| `maxSize` | 单文件最大字节数，超出后自动轮转 | `50–200 MB` |
| `maxFiles` | 保留文件数量上限 | `7–30` |
| `maxAge` | 文件保留天数，超期自动删除 | `7–30` |
| `compress` | 压缩非当日 `.log` 为 `.log.gz` | `true`（磁盘紧张时） |
| `retryCount` | 写入失败重试次数 | `3`（默认） |
| `retryDelay` | 重试间隔基数（毫秒），实际延迟 = `retryDelay × attempt` | `100`（默认） |

---

## 异步写入参数选型

| 参数 | 说明 | 低流量 | 高流量 |
|------|------|--------|--------|
| `queueSize` | 队列容量 | 1000 | 5000–10000 |
| `batchSize` | 每批写入条数 | 100 | 500–1000 |
| `flushInterval` | 最大刷新间隔（ms） | 1000 | 500 |
| `overflowStrategy` | 队列满时策略 | `block` | `drop` |

**策略说明**：
- `drop`：丢弃新消息，零阻塞，适合极高并发
- `block`：等待当前批次写完后继续，保证不丢失
- `overflow`：当前与 `block` 等效

---

## 优雅关闭

务必在进程退出前 `await log.close()`，否则异步队列中的消息将丢失。

```typescript
async function shutdown(signal: string) {
  log.info(`收到 ${signal}，正在关闭...`)
  await log.close()
  process.exit(0)
}

process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT',  () => shutdown('SIGINT'))
```

---

## 日志级别建议

| 环境 | 推荐级别 | 说明 |
|------|----------|------|
| 开发 | `debug` | 完整信息，便于排查 |
| 测试 | `info` | 过滤冗余调试信息 |
| 生产 | `warn` 或 `info` | 减少 I/O，按需调整 |
| 降障排查 | 运行时 `setLevel('debug')` | 动态提升，无需重启 |

---

## 事件监控接入

```typescript
log.on('fileWriteError', (e) => {
  // 文件写入失败：磁盘满、权限变更等
  alerting.trigger({
    title: '日志写入失败',
    message: e.message,
    severity: 'critical',
  })
})

log.on('levelChange', (e) => {
  metrics.gauge('log_level', e.data?.newLevel)
})
```

---

## 目录权限

运行进程需要对日志目录有 **读写** 权限：

```bash
mkdir -p /var/log/myapp
chown app:app /var/log/myapp
chmod 755 /var/log/myapp
```

---

## 磁盘空间估算

```
daily_size = avg_msg_bytes × msgs_per_second × 86400
total_size = daily_size × maxAge
```

例：平均消息 200 B，1000 条/秒，保留 7 天：
```
200 × 1000 × 86400 × 7 ≈ 120 GB
```

建议配合 `maxFiles` + `compress: true` 控制实际占用。
