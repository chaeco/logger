# @chaeco/logger

一个功能丰富、高性能的 Node.js 日志库。

[![npm version](https://img.shields.io/badge/版本-1.0.1-blue.svg)](https://github.com/chaeco/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933.svg)](https://nodejs.org/)
[![Build](https://img.shields.io/badge/构建-通过-brightgreen.svg)](https://github.com/chaeco/logger)
[![Coverage](https://img.shields.io/badge/测试-162%20tests-brightgreen.svg)](https://github.com/chaeco/logger)

[English](README.md) | 中文

## 功能特性

- ✅ **标准日志级别**: `debug`、`info`、`warn`、`error` 和 `silent`。
- ✅ **自动上下文**: 自动捕获调用者文件路径和行号。
- ✅ **文件管理**:
  - 基于大小的自动日志轮转。
  - 基于时间/数量的自动清理旧日志。
  - 内置 Gzip 压缩归档日志。
- ✅ **异步队列**: 高性能异步批量写入，支持 `drop` / `block` / `overflow` 溢出策略。
- ✅ **格式化**: 纯文本、JSON 格式及自定义 formatter 函数。
- ✅ **事件钩子**: 支持 `levelChange`、`fileWriteError` 事件监听。
- ✅ **子 Logger**: `logger.child('module')` 继承父级配置，独立命名。
- ✅ **TypeScript 原生支持**: 完整的类型安全和智能感知。
- ⚠️ **仅支持 Node.js**: 不支持浏览器环境。

## 安装

```bash
npm install github:chaeco/logger
```

## 快速开始

### 基本用法

```typescript
import { logger } from '@chaeco/logger'

// 直接使用 - 首次写入时自动创建目录
logger.info('应用已启动')
logger.warn('检测到警告', { code: 4001 })
logger.error(new Error('数据库连接失败'))
logger.debug('调试信息', { timing: 142 })

// 禁用日志
logger.setLevel('silent')
```

> **注意**: 日志目录会在首次日志记录时自动创建，不需要手动初始化。

### 高级配置

```typescript
import { Logger } from '@chaeco/logger'

const logger = new Logger({
  level: 'info',
  name: 'api-service',
  file: {
    path: './logs',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 30,
    maxAge: 30, // 天数
    compress: true, // 压缩今天之前的日志文件（gzip）
  },
  console: { enabled: true, colors: true, timestamp: true },
  async: {
    enabled: true,
    queueSize: 5000, // 默认值：适合中等-高并发
    batchSize: 200,
    flushInterval: 500,
    overflowStrategy: 'block', // 推荐用 block，保证日志不丢失
  },
  format: { json: true, jsonIndent: 2 },
  errorHandling: {
    silent: true,
    onError: (err, ctx) => console.error(`[${ctx}]`, err.message),
  },
})
```

#### 异步队列配置指南

根据应用 QPS 选择合适的异步队列参数（仅在 `async.enabled: true` 时有效）：

| 应用规模 | QPS    | queueSize  | batchSize | flushInterval | overflowStrategy |
| -------- | ------ | ---------- | --------- | ------------- | ---------------- |
| 低并发   | < 1k   | 1000-2000  | 50-100    | 1000-2000     | drop             |
| 中等并发 | 1k-10k | **5000**   | **200**   | **500**       | **block**        |
| 高并发   | > 10k  | 8000-10000 | 300-500   | 100-300       | block            |

**字段说明**：

- `queueSize`：内存中最多缓冲多少条消息。超过时的处理由 `overflowStrategy` 决定
- `batchSize`：每次磁盘写入打包多少条消息（越大 I/O 越高效）
- `flushInterval`：最多等待多久触发一次写入（毫秒）
- `overflowStrategy`：队列满时的策略
  - `drop`：丢弃新消息（最快，但会丢日志）
  - `block`：等待当前批次写完再入队（推荐，保证不丢日志）
  - `overflow`：当前与 block 等效

#### 文件保留语义

- `maxFiles` 是同一 `path + filename` 范围内物理文件总数上限（`.log` + `.log.gz`）。
- 当 `compress: true` 时，会先把同一天旧分片合并为一个 `.log.gz`，再执行按数量裁剪。
- 按数量裁剪会优先保留更新日期与更新分片，且会保护当前活跃写入文件。

#### 进程边界说明

- 在单进程内，父 logger 与 `child()` logger 共享同一条文件写入管线。
- 多进程同时写同一个 `path + filename` 时，不保证严格有序或零丢失。
- 在 cluster / PM2 等场景，建议按进程区分 `filename`（如追加 PID），再由上游系统聚合。

### 子 Logger

```typescript
const dbLogger = logger.child('db')
dbLogger.info('已连接') // 输出名称为 [api-service:db]

const reqLogger = logger.child('request')
reqLogger.warn('响应较慢', { duration: 3200 })
```

> 同一进程内，子 logger 与父 logger 共享文件输出管线。

### 事件钩子

```typescript
logger.on('levelChange', (e) => {
  console.log(`日志级别变更: ${e.data.oldLevel} → ${e.data.newLevel}`)
})

logger.on('fileWriteError', (e) => {
  // 触发外部告警（如 Sentry、钉钉机器人等）
  console.error('日志写入失败:', e.error?.message)
})
```

### 生命周期

```typescript
// 进程退出前刷新异步队列并关闭文件句柄
process.on('SIGTERM', async () => {
  await logger.close()
  process.exit(0)
})
```

## 文档

- [详细示例](docs/examples.md)
- [性能优化](docs/performance.md)
- [生产部署最佳实践](docs/production.md)
- [更新日志](CHANGELOG.md)

## 许可证

MIT © [chaeco](https://github.com/chaeco)
