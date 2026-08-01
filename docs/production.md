# 生产环境部署指南

> **运行时要求**：仅支持 Node.js，不支持浏览器环境。

---

## 推荐配置

### 标准 Web 服务（1k-10k req/s）

```typescript
import { Logger } from '@chaeco/logger'

const log = new Logger({
  name: 'app',
  level: process.env.LOG_LEVEL as any ?? 'info',
  file: {
    path: process.env.LOG_PATH ?? './logs',
    filename: 'app',
    maxSize: 100 * 1024 * 1024, // 100 MB 时自动轮转
    maxFiles: 14,               // 保留最多 14 个文件
    maxAge: 30,                 // 超过 30 天自动删除
    compress: true,             // 压缩非当日日志为 .gz
  },
  async: {
    enabled: true,
    queueSize: 5000,   // 默认值：适合中等-高并发
    batchSize: 200,    // 每次写入打包 200 条消息
    flushInterval: 500, // 最多等待 500ms 触发一次写入
    overflowStrategy: 'block', // 推荐：队列满时等待，保证日志不丢失
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

### 高频微服务（> 10k req/s）

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
    queueSize: 10000,  // 充分缓冲，应对流量突发
    batchSize: 500,    // 大批次提高 I/O 效率
    flushInterval: 100, // 频繁刷新，避免积压
    overflowStrategy: 'drop', // 极端吞吐优先保护服务，可容忍少量日志丢失
  },
  console: { enabled: false },
  format: {
    json: true,       // 结构化日志，便于采集和分析
    jsonIndent: 0,    // 不缩进，减少文件大小
    includeStack: false, // 高并发时禁用堆栈捕获
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

`maxFiles` 语义补充：
- 统计对象是物理文件总数（`.log` + `.log.gz`）。
- 在 `compress: true` 下，先压缩归档，再执行数量裁剪。
- 数量裁剪优先保留新日期和新分片，并保护当前活跃文件。

多进程边界：
- 单进程（含 child logger）是共享同一文件写入器。
- 多进程同时写同一 `path + filename` 不保证严格有序与零丢失。
- 建议使用 `filename: \`app-${process.pid}\`` 等方式按进程拆分。

---

## 异步写入参数速查表

根据应用的预期 QPS（每秒请求数）选择合适的异步队列参数（仅在 `async.enabled: true` 时生效）：

| 并发规模 | QPS | queueSize | batchSize | flushInterval | overflowStrategy | 特点 |
|--------|-----|----|----------|---------------|-----------------|------|
| 低流量 | < 1k | 1000 | 50-100 | 1000-2000 | `drop` | 低延迟，可接纳丢失 |
| **标准** | **1k-10k** | **5000** | **200** | **500** | **`block`** | **默认推荐，保证不丢** |
| 高流量 | > 10k | 10000 | 500+ | 100-300 | `drop` | 保护服务，可接纳丢失 |

**参数解释**：
- `queueSize`: 内存中最多缓冲多少条消息；超过后由 `overflowStrategy` 决定是否丢弃或等待
- `batchSize`: 每次磁盘写入打包多少条消息（越大 I/O 效率越高）
- `flushInterval`: 即使未达到 `batchSize`，等待多久就强制刷新（毫秒）
- `overflowStrategy`: 队列满时的处理方式
  - `drop`: 直接丢弃新消息，**响应最快但可能丢日志**
  - `block`: 等待当前批次写完后继续入队，**保证日志完整但可能延迟业务线程**

**选择建议**：
| 场景 | 推荐策略 | 原因 |
|------|--------|------|
| 标准 Web 应用 | `block` | 日志通常不能丢，接受毫秒级延迟 |
| 金融/支付系统 | `block` + 增大 queueSize | 绝对不能丢日志 |
| 实时流计算 | `drop` | 超低延迟优先，少量日志丢失可接受 |
| 信息流推荐系统 | `drop` | 吞吐量优先，丢日志影响有限 |

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
