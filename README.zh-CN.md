# @chaeco/logger

一个功能丰富、高性能的 Node.js 日志库。

[![npm version](https://img.shields.io/badge/版本-0.1.6-blue.svg)](https://github.com/chaeco/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933.svg)](https://nodejs.org/)
[![Build](https://img.shields.io/badge/构建-通过-brightgreen.svg)](https://github.com/chaeco/logger)
[![Coverage](https://img.shields.io/badge/测试-77%20tests-brightgreen.svg)](https://github.com/chaeco/logger)

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
import { logger } from '@chaeco/logger';

// 直接使用 - 首次写入时自动创建目录
logger.info('应用已启动');
logger.warn('检测到警告', { code: 4001 });
logger.error(new Error('数据库连接失败'));
logger.debug('调试信息', { timing: 142 });

// 禁用日志
logger.setLevel('silent');
```

> **注意**: 日志目录会在首次日志记录时自动创建，不需要手动初始化。

### 高级配置

```typescript
import { Logger } from '@chaeco/logger';

const logger = new Logger({
  level: 'info',
  name: 'api-service',
  file: {
    path: './logs',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 30,
    maxAge: 30,                 // 天数
    compress: true,             // 压缩今天之前的日志文件（gzip）
  },
  console: { enabled: true, colors: true, timestamp: true },
  async: {
    enabled: true,
    batchSize: 100,
    flushInterval: 1000,
    overflowStrategy: 'drop',   // 'drop' | 'block' | 'overflow'
  },
  format: { json: true, jsonIndent: 2 },
  errorHandling: {
    silent: true,
    onError: (err, ctx) => console.error(`[${ctx}]`, err.message),
  },
});
```

### 子 Logger

```typescript
const dbLogger = logger.child('db');
dbLogger.info('已连接');          // 输出名称为 [api-service:db]

const reqLogger = logger.child('request');
reqLogger.warn('响应较慢', { duration: 3200 });
```

### 事件钩子

```typescript
logger.on('levelChange', (e) => {
  console.log(`日志级别变更: ${e.data.oldLevel} → ${e.data.newLevel}`);
});

logger.on('fileWriteError', (e) => {
  // 触发外部告警（如 Sentry、钉钉机器人等）
  console.error('日志写入失败:', e.error?.message);
});
```

### 生命周期

```typescript
// 进程退出前刷新异步队列并关闭文件句柄
process.on('SIGTERM', async () => {
  await logger.close();
  process.exit(0);
});
```

## 文档

- [详细示例](docs/zh-CN/examples.md)
- [性能优化](docs/zh-CN/performance.md)
- [生产部署最佳实践](docs/zh-CN/production.md)
- [更新日志](docs/zh-CN/CHANGELOG.md)

## 许可证

MIT © [chaeco](https://github.com/chaeco)
