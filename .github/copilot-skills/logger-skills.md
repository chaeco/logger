# GitHub Copilot Skills: @chaeco/logger

This guide provides instructions and context for GitHub Copilot to help developers use the `@chaeco/logger` library effectively.

## Project Context
`@chaeco/logger` is a high-performance, cross-platform logging library for Node.js and Browser environments. It supports log levels, rotation, compression, async writing, sampling, rate limiting, and filtering.

## Common Tasks

### 1. Simple Logging
**Query:** "How to log a basic message with chaeco logger?"
**Skill:**
Use the default `logger` instance exported from the package.
```typescript
import { logger } from '@chaeco/logger';

logger.info('Hello world');
logger.error('An error occurred', { error: err });
```

### 2. Custom Configuration
**Query:** "Create a custom logger with file rotation and compression."
**Skill:**
Instantiate the `Logger` class with `FileOptions`.
```typescript
import { Logger } from '@chaeco/logger';

const logger = new Logger({
  level: 'info',
  name: 'my-app',
  file: {
    enabled: true,
    path: './logs',
    filename: 'app',
    maxSize: 10 * 1024 * 1024, // 10MB
    maxFiles: 30,
    compress: true
  }
});
```

### 3. Asynchronous Performance
**Query:** "How to enable high-performance async logging?"
**Skill:**
Configure the `async` property in `LoggerOptions`. This is recommended for production Node.js services.
```typescript
const logger = new Logger({
  async: {
    enabled: true,
    batchSize: 100,
    flushInterval: 1000
  }
});
```

### 4. Advanced Controls (Sampling & Rate Limiting)
**Query:** "How to sample 10% of logs and limit to 100 logs/sec?"
**Skill:**
```typescript
const logger = new Logger({
  sampling: {
    enabled: true,
    rate: 0.1
  },
  rateLimit: {
    enabled: true,
    maxLogsPerWindow: 100,
    windowSize: 1000
  }
});
```

## Best Practices
- **Use Child Loggers:** For modular applications, use `logger.child('module-name')` to maintain context.
- **Production Settings:** Always enable `async` mode and `compress: true` in production.
- **Error Handling:** Use `logger.error(err)` passing the actual Error object to capture full stack traces.
- **Circular References:** The logger safely handles circular references in logged objects.

## API Reference
- `LogLevel`: 'debug' | 'info' | 'warn' | 'error' | 'silent'
- `LoggerOptions`: { level, name, file, console, sampling, rateLimit, filter, format, async, errorHandling }
- `Events`: 'levelChange', 'fileWriteError', 'rateLimitExceeded'
