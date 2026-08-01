# @chaeco/logger — AI-Assisted Usage Guide

> This file guides both contributors to the logger library and downstream consumers using it.
> AI coding tools (Claude Code, Cursor, Copilot, etc.) should reference these patterns.

## For Contributors (working on this repo)

### Build & Test

```bash
npm run build          # TypeScript compile to dist/
npm test               # Jest (196 tests)
npm run test:coverage  # Jest with coverage
npm run lint           # ESLint
npm run format:check   # Prettier check
```

### Project Structure

| Path           | Purpose                                         |
| -------------- | ----------------------------------------------- |
| `src/index.ts` | Public API exports + default logger instance    |
| `src/core/`    | Logger core, types                              |
| `src/file/`    | FileManager, rotation, compression, async queue |
| `src/utils/`   | Formatter, caller-info, date utils              |
| `tests/`       | Jest test suites                                |
| `examples/`    | Runnable examples                               |
| `docs/`        | Extended documentation                          |

### Architecture Notes

- `Logger` is a flat class (no inheritance). Child loggers share the parent's `FileManager` via `ownsFileManager` flag.
- `FileManager` handles file rotation, compression, and async queue. One per process unless explicitly isolated.
- `CallerInfoHelper` captures stack trace for `file`/`line` — disabled when `format.includeStack: false`.
- `LogFormatter` splits console vs file formatting; console format includes ANSI colors.
- All public types live in `src/core/types.ts`. Internal types stay in their respective modules.

### Gate

Run `npm run build && npm test` before committing. Coverage target: keep 196 tests passing.

---

## For Downstream Consumers (AI tools using @chaeco/logger in a project)

### Canonical Import Pattern

```typescript
// Default instance: quick start for single-service apps
import { logger } from '@chaeco/logger'

// Custom instance: multiple services, isolated configs
import { Logger } from '@chaeco/logger'
```

### Minimum Production Config

The library has a **default instance** (`logger`) ready out of the box, but for production control, create one explicitly:

```typescript
import { Logger } from '@chaeco/logger'

const log = new Logger({
  name: 'app',
  level: (process.env.LOG_LEVEL as any) ?? 'info',
  file: {
    path: process.env.LOG_PATH ?? './logs',
    filename: 'app',
    maxSize: 100 * 1024 * 1024,
    maxFiles: 14,
    maxAge: 30,
    compress: true,
  },
  async: {
    enabled: true,
    queueSize: 5000,
    batchSize: 200,
    flushInterval: 500,
    overflowStrategy: 'block', // never lose logs
  },
  console: {
    enabled: process.env.NODE_ENV !== 'production',
    colors: true,
    timestamp: true,
  },
  errorHandling: {
    silent: true,
    onError: (err, ctx) => {
      /* alerting */
    },
  },
})
```

### Graceful Shutdown (REQUIRED)

**Always** call `await log.close()` on process exit — failing to do so will lose buffered async log messages.

```typescript
async function shutdown(signal: string) {
  log.info(`Received ${signal}, shutting down...`)
  await log.close()
  process.exit(0)
}
process.on('SIGTERM', () => shutdown('SIGTERM'))
process.on('SIGINT', () => shutdown('SIGINT'))
```

### Child Loggers (same-process only)

```typescript
const dbLog = log.child('db') // inherits all config, name becomes "app:db"
dbLog.info('Connected')
```

Child loggers share the parent's file writer — no new FileManager, no file contention.

### JSON Output (for ELK / Loki / Datadog)

```typescript
const log = new Logger({
  format: { json: true, jsonIndent: 0, includeStack: false },
})
```

### Runtime Level Change

```typescript
log.setLevel('debug') // increase verbosity on the fly without restart
log.setLevel('silent') // suppress all output
```

### API Surface (types from `@chaeco/logger`)

```typescript
import type {
  LogLevel,
  LoggerOptions,
  FileOptions,
  ConsoleOptions,
  FormatOptions,
  AsyncWriteOptions,
  ErrorHandlingOptions,
  LogEntry,
  LoggerEvent,
} from '@chaeco/logger'
```

### Level Priority

`debug` (0) < `info` (1) < `warn` (2) < `error` (3) < `silent` (999)

### Async Strategy Decision Table

| Workload        | strategy | Why                              |
| --------------- | -------- | -------------------------------- |
| Audit / payment | `block`  | Must not lose logs               |
| Standard web    | `block`  | Prefer correctness over latency  |
| High-throughput | `drop`   | Prefer throughput, tolerate loss |
| Real-time       | `drop`   | Latency over log completeness    |

### File Retention

- `maxFiles` caps total physical files (`.log` + `.log.gz`) in the directory.
- `compress: true` merges same-day shards into a daily `.log.gz`, then prunes by count.
- Pruning favors newer dates and shards, always preserving the active file.

### Multi-Process

Multi-process writes to the same `path + filename` **are not guaranteed lossless or ordered**. Use per-process filenames:

```typescript
filename: `app-${process.pid}`
```

### Anti-Patterns (Do NOT)

- ❌ Do NOT forget `await log.close()` in shutdown handlers.
- ❌ Do NOT call `new Logger()` per request — create one instance at startup.
- ❌ Do NOT use `child()` across process boundaries.
- ❌ Do NOT set console `enabled: true` in production for high-throughput services.
- ❌ Do NOT set `includeStack: true` in high-QPS JSON mode.
- ❌ The library is **Node.js only** — no browser support.
