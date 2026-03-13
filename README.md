# @chaeco/logger

A feature-rich, high-performance logging library for Node.js.

[![npm version](https://img.shields.io/badge/version-0.1.6-blue.svg)](https://github.com/chaeco/logger)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-3178c6.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D16-339933.svg)](https://nodejs.org/)
[![Build](https://img.shields.io/badge/build-passing-brightgreen.svg)](https://github.com/chaeco/logger)
[![Coverage](https://img.shields.io/badge/coverage-77%20tests-brightgreen.svg)](https://github.com/chaeco/logger)

[English](README.md) | [中文](README.zh-CN.md)

## Features

- ✅ **Standard Log Levels**: `debug`, `info`, `warn`, `error`, and `silent`.
- ✅ **Auto-Context**: Automatically captures caller file path and line numbers.
- ✅ **File Management**: Size-based rotation, age/count cleanup, Gzip compression.
- ✅ **Async Queue**: Batch writing with `drop` / `block` / `overflow` strategies.
- ✅ **Formatting**: Plain text, JSON, and custom `formatter` function.
- ✅ **Event Hooks**: `levelChange`, `fileWriteError` event listeners.
- ✅ **Child Logger**: `logger.child('module')` inherits config with scoped name.
- ✅ **TypeScript Native**: Full type safety and intellisense.
- ⚠️ **Node.js only**: Browser environments are not supported.

## Installation

```bash
npm install github:chaeco/logger
```

## Quick Start

### Basic Usage

```typescript
import { logger } from '@chaeco/logger';

// Use directly - directory is created automatically on first write
logger.info('Application started');
logger.warn('Warning detected', { code: 4001 });
logger.error(new Error('Database connection failed'));
logger.debug('Debug details', { timing: 142 });

// Disable logging
logger.setLevel('silent');
```

> **Note**: Log directories are created automatically upon the first log entry. No manual initialization is required.

### Advanced Configuration

```typescript
import { Logger } from '@chaeco/logger';

const logger = new Logger({
  level: 'info',
  name: 'api-service',
  file: {
    path: './logs',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 30,
    maxAge: 30,                 // days
    compress: true,             // gzip logs older than today
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

### Child Logger

```typescript
const dbLogger = logger.child('db');
dbLogger.info('Connected');       // logged as [api-service:db]

const reqLogger = logger.child('request');
reqLogger.warn('Slow response', { duration: 3200 });
```

### Event Hooks

```typescript
logger.on('levelChange', (e) => {
  console.log(`Level changed: ${e.data.oldLevel} → ${e.data.newLevel}`);
});

logger.on('fileWriteError', (e) => {
  // trigger external alert (e.g. Sentry, PagerDuty)
  console.error('Log write failed:', e.error?.message);
});
```

### Lifecycle

```typescript
// Flush async queue and close file handles before process exit
process.on('SIGTERM', async () => {
  await logger.close();
  process.exit(0);
});
```

## Documentation

- [Detailed Examples](docs/examples.md)
- [Performance Optimization](docs/performance.md)
- [Production Best Practices](docs/production.md)
- [Changelog](CHANGELOG.md)

## License

MIT © [chaeco](https://github.com/chaeco)
