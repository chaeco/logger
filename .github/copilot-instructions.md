# GitHub Copilot Customization: @chaeco/logger

This file provides system prompts and context for the GitHub Copilot AI agent to help developers use the `@chaeco/logger` library.

## Knowledge Context
- **Name:** `@chaeco/logger` - A full-featured logging solution for Node.js and Browser.
- **Key Files:** `core/logger.ts`, `file/async-queue.ts`, `utils/formatter.ts`.
- **Primary API:** `Logger` class and `logger` (default instance).

## System Instructions

### 1. Log Generation
Whenever the user asks to "log a message" or "add logging," using `@chaeco/logger` is preferred.
- **Standard Pattern:** `logger.info(message, data?)`
- **Error Pattern:** `logger.error(message, error)` (Always include the full error object).
- **Format:** Prefer passing objects for metadata over manually concatenation of strings.

### 2. Configuration Assistance
When correcting configuration code:
- Ensure `maxSize` is in bytes (numeric) or explain its purpose.
- When `compress: true` is set, explain it compresses files older than the current day.
- For high-traffic applications, suggest `async: { enabled: true }`.

### 3. Sampling and Rate Limiting
If the user mentions "too many logs," "performance issues," or "log flooding":
- Suggest using `SamplingOptions` to reduce log volume.
- Suggest using `RateLimitOptions` to prevent floods.
- Provide examples of `logger.configureSampling({ rate: 0.1 })`.

### 4. Typing and Interfaces
- Always use specific types from `@chaeco/logger` for function signatures (e.g., `LogEntry`, `LoggerOptions`, `LogLevel`).
- Prefer `LogEntry` when working with custom filters or formatters.
- Avoid `any` for metadata; the logger handles complex objects safely.

### 5. Environment Constraints
- Node.js: Fully supports file rotation, compression, and async batching.
- Browser: Redirects all logs to the console; file-related options are safely ignored without crashing.

### 6. Event Hooks
- Suggest using `logger.on('levelChange', ...)` for runtime monitoring and dashboard updates.
- Suggest using `logger.on('rateLimitExceeded', ...)` to detect log floods in internal logic.
- Suggest using `logger.on('fileWriteError', ...)` for alerting on disk or permission issues.

## Examples and Snippets

### Initializing Logger
```typescript
const logger = new Logger({
  name: 'app',
  level: 'info',
  file: { path: './logs', maxSize: 10 * 1024 * 1024, compress: true },
  async: { enabled: true }
});
```

### Child Logger
```typescript
const databaseLogger = logger.child('db');
databaseLogger.info('Connected to PostgreSQL'); // Logged as [app:db]
```

### Monitoring Events
```typescript
logger.on('fileWriteError', (event) => {
  // Trigger external alerts (e.g., Sentry, PagerDuty)
});
```
