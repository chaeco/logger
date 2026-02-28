# @chaeco/logger

A feature-rich, high-performance, cross-platform logging library for Node.js and Browser environments.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue.svg)](https://www.typescriptlang.org/)

[中文文档 (Chinese)](docs/zh-CN/README.md)

## Features

- ✅ **Cross-platform**: Seamless support for Node.js and modern browsers.
- ✅ **Standard Log Levels**: `debug`, `info`, `warn`, `error`, and `silent`.
- ✅ **Auto-Context**: Automatically captures caller file path and line numbers.
- ✅ **File Management** (Node.js):
  - Automatic log rotation based on size.
  - Automatic cleanup of old logs based on age/count.
  - Built-in Gzip compression for archived logs.
- ✅ **Async Queue**: High-performance asynchronous batch writing with overflow strategies.
- ✅ **Browser Support**: Console output with optional storage capabilities.
- ✅ **Advanced Features**: Log sampling, rate limiting, and custom filters.
- ✅ **Extensible**: Support for custom formatters and event hooks (`levelChange`, `fileWriteError`, etc.).
- ✅ **TypeScript Native**: Full type safety and intellisense.

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
    enabled: true,
    path: './logs',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 30,
    maxAge: 30,                 // Days
    compress: true              // Compress logs older than current day
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

## Documentation

- [Detailed Examples](docs/examples.md)
- [Performance Optimization](docs/performance.md)
- [Production Best Practices](docs/production.md)
- [Changelog](CHANGELOG.md)

## License

MIT © [chaeco](https://github.com/chaeco)
