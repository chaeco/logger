# @chaeco/logger

一个功能丰富、高性能的 Node.js 日志库。

[![npm version](https://img.shields.io/badge/版本-0.1.6-blue.svg)](https://github.com/chaeco/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933.svg)](https://nodejs.org/)
[![Build](https://img.shields.io/badge/构建-通过-brightgreen.svg)](https://github.com/chaeco/logger)
[![Coverage](https://img.shields.io/badge/测试-77%20tests-brightgreen.svg)](https://github.com/chaeco/logger)

[English](README.md) | [中文文档](docs/zh-CN/README.md)

## 功能特性

- ✅ **跨平台支持**: 无缝支持 Node.js 和现代浏览器。
- ✅ **标准日志级别**: `debug`、`info`、`warn`、`error` 和 `silent`。
- ✅ **自动上下文**: 自动捕获调用者文件路径和行号。
- ✅ **文件管理** (Node.js):
  - 基于大小的自动日志轮转。
  - 基于时间/数量的自动清理旧日志。
  - 内置 Gzip 压缩归档日志。
- ✅ **异步队列**: 高性能异步批量写入与溢出处理策略。
- ✅ **浏览器支持**: 控制台输出以及可选的存储能力。
- ✅ **高级功能**: 日志采样、速率限制和自定义过滤器。
- ✅ **可扩展性**: 支持自定义格式化器和事件钩子（`levelChange`、`fileWriteError` 等）。
- ✅ **TypeScript 原生支持**: 完整的类型安全和智能感知。

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
    enabled: true,
    path: './logs',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 30,
    maxAge: 30,                 // 天数
    compress: true              // 压缩当前日期之前的日志
  },
  console: {
    enabled: true,
    colors: true,
    timestamp: true
  },
  async: {
    enabled: true,
    batchSize: 100,
    flushInterval: 1000
  }
});
```

## 文档

- [详细示例](docs/zh-CN/examples.md)
- [性能优化](docs/zh-CN/performance.md)
- [生产部署最佳实践](docs/zh-CN/production.md)
- [更新日志](docs/zh-CN/CHANGELOG.md)

## 许可证

MIT © [chaeco](https://github.com/chaeco)
