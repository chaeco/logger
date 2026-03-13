# 性能优化指南

> **运行时要求**：仅支持 Node.js，不支持浏览器环境。

---

## 核心性能策略

### 1. 开启异步写入

日志写入是 I/O 密集型操作。同步写入会阻塞事件循环，异步批量写入可将写 I/O 影响降至最低：

```typescript
const log = new Logger({
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 500,
    flushInterval: 500,
    overflowStrategy: 'drop', // 高并发场景优先保护吞吐
  },
})
```

**效果**：同步写入约 5,000–10,000 条/秒；异步批量可达 50,000–200,000 条/秒。

---

### 2. 合理设置日志级别

生产环境无需输出 `debug`，直接设为 `info` 或 `warn`，减少格式化与写入开销：

```typescript
const log = new Logger({ level: 'warn' })
```

运行时按需提升（无需重启）：

```typescript
log.setLevel('debug') // 排查时临时提升
log.setLevel('warn')  // 恢复
```

---

### 3. 关闭控制台输出

控制台 I/O 在高并发场景下代价不低，生产环境建议关闭：

```typescript
const log = new Logger({
  console: { enabled: false },
})
```

---

### 4. 关闭调用栈解析

`includeStack` 需要每次解析 `Error.stack`，高频调用时有一定开销，生产环境可关闭：

```typescript
const log = new Logger({
  format: { includeStack: false },
})
```

> 内置 LRU 缓存（默认容量 1000）会自动缓存相同调用位置的解析结果，重复调用几乎零成本。

---

### 5. 使用 JSON 格式

JSON 格式省去了字符串拼接与颜色渲染，序列化开销可忽略不计，同时对采集系统更友好：

```typescript
const log = new Logger({
  format: { json: true, jsonIndent: 0, includeStack: false },
  console: { enabled: false },
})
```

---

### 6. 合理配置文件大小与轮转

- `maxSize` 过小 → 轮转频繁，增加 `rename` / `stat` 系统调用
- `maxSize` 过大 → 单文件 I/O 写入变慢，且崩溃恢复代价大

**推荐**：50–200 MB，根据日均日志量调整。

---

## 基准数据（参考）

以下数据在 Apple M2 Pro / Node.js 20 / SSD 环境测得，仅供参考：

| 模式 | 吞吐量 | 延迟（P99） |
|------|--------|------------|
| 仅控制台（彩色） | ~60,000 条/秒 | < 0.02 ms |
| 同步写文件 | ~8,000 条/秒 | < 0.2 ms |
| 异步批量写文件（batch=500） | ~150,000 条/秒 | < 0.01 ms |
| JSON 格式 + 异步 | ~180,000 条/秒 | < 0.01 ms |

---

## 内存开销

- **AsyncQueue**：每条消息约 100–300 B（取决于内容长度），`queueSize=5000` 约占 1–2 MB
- **CallerInfoHelper LRU 缓存**：最多 1000 条缓存项，约 200 KB
- **Logger 实例**：约 5–10 KB（不含 FileManager）

---

## 最优生产配置小结

```typescript
const log = new Logger({
  name: 'app',
  level: 'info',
  file: {
    path: './logs',
    filename: 'app',
    maxSize: 100 * 1024 * 1024,
    maxFiles: 14,
    maxAge: 30,
    compress: true,
  },
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 500,
    flushInterval: 500,
    overflowStrategy: 'drop',
  },
  format: {
    json: true,
    jsonIndent: 0,
    includeStack: false,
  },
  console: { enabled: false },
  errorHandling: { silent: true, fallbackToConsole: false },
})
```
