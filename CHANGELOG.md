# @chaeco/logger Changelog

All notable changes to this project will be documented in this file.

## [v1.0.3] - 2026-08-14

### Fixed

- **`updateConfig` FileManager 关闭失败不再静默** — 重建或禁用文件输出时，旧 `FileManager.close()` 失败（如异步队列仍有残留数据）现在会输出 `console.warn` 提示，而不是静默吞掉可能的数据丢失。

### Changed

- **Install docs** — READMEs (EN/ZH) 改为 `npm install @chaeco/logger`（包已发布到 npm），移除原先的 GitHub 安装指令。
- **package-lock version sync** — lockfile 自引用版本已同步（此前停留在 1.0.0）。

### Added

- **Project website** — `website/` 落地页（统一 Chaeco 深色终端风格），含活终端演示、异步队列 QPS 参考表与安装 CTA。
- **GitHub Pages workflow** — `.github/workflows/pages.yml` 将 `website/` 部署到 GitHub Pages。

## [v1.0.2] - 2026-08-01

### Fixed

- **P1: `updateConfig` 缺少 `await` 导致数据丢失**: `updateConfig` 改为 `async`，`close()` 加上 `await`，确保异步队列刷新完成后再替换 FileManager。
- **P2: `CallerInfoHelper` 过时路径排除**: 将 `/plugins/logger/` 替换为 `@chaeco/logger`，确保库内部帧被正确过滤。
- **P2: `CallerInfoHelper` 缓存淘汰策略**: 从 FIFO 改为真正 LRU，缓存命中时重新插入到末尾，提高高频调用点的缓存命中率。
- **P2: `AsyncQueue.stop()` 并发 `enqueue` 问题**: 添加 `isStopping` 标志，`stop()` 期间拒绝新消息，防止提前终止导致日志丢失。
- **`warn` 级别控制台路由**: 从 `console.log` 改为 `console.warn`，与主流日志库行为一致。
- **Error 对象序列化**: 将 `error.stack` 拆解为 `{message, name, stack}` 结构体，修复 JSON 输出时 Error 被序列化为 `{}` 的问题。
- **`overflowStrategy` 默认值**: 从 `'drop'` 改为 `'block'`，默认不丢日志。

### Removed

- **`overflow` 溢出策略**: 移除与 `block` 完全等效的冗余 `overflow` 策略，简化类型和逻辑。
- **`CallerInfoHelper.simpleHash`**: 移除 13 行自定义哈希函数，直接用堆栈字符串作为缓存键，消除碰撞风险，简化代码。

### Changed

- **`updateConfig` 签名**: 从 `void` 改为 `Promise<void>`（`async`），调用方需 `await`。
- **`AsyncWriteOptions.overflowStrategy` 类型**: 从 `'drop' | 'block' | 'overflow'` 简化为 `'drop' | 'block'`。
- **`tsconfig.json`**: 移除多余的 `DOM` 库类型和 `experimentalDecorators`/`emitDecoratorMetadata`。
- **`jest.config.js`**: 移除 `!src/index.ts` 覆盖排除，使默认 logger 实例纳入覆盖统计。
- 文档和示例中的 `updateConfig` 调用添加 `await`。

### Verification

- Build and test baseline for this release:
  - `npm run build`
  - `npx jest` (196 tests passed)

## [v1.0.1] - 2026-06-09

### Added

- `CLAUDE.md` with architecture notes, build/test commands, and AI-tooling guidance for contributors.

### Changed

- Removed `CLAUDE.md` from npm publish files (it serves contributors in-repo, not consumers).

## [v1.0.0] - 2026-03-24

### Highlights

- First stable major release.
- Async queue defaults tuned for production-ready behavior under medium/high traffic.
- Documentation and examples aligned with default-safe strategy guidance.

### Changed

- Promoted package version to **1.0.0** for the first stable release.
- Updated async queue defaults for better production behavior under medium-to-high concurrency:
  - `queueSize`: `1000` -> `5000`
  - `batchSize`: `100` -> `200`
  - `flushInterval`: `1000` -> `500`

### Breaking Changes

- No API signature breaking changes.
- Behavioral change: when async logging is enabled and custom async options are not provided, buffering/flush behavior now uses the new defaults listed above.

### Upgrade Guide

1. If you rely on old flush cadence/queue limits, pin explicit async options in your logger config to preserve previous behavior.
2. Review overflow policy by workload:
   - Prefer `overflowStrategy: 'block'` for audit/critical logs (no loss).
   - Prefer `overflowStrategy: 'drop'` for throughput-first workloads (bounded latency).
3. In multi-process deployments, keep per-process `filename` (or include PID) to avoid cross-process write contention.

### Verification

- Build and test baseline for this release:
  - `npm run build`
  - `npx jest --coverage` (162 tests passed)

### Docs

- Updated README/README.zh-CN version badges to `1.0.0`.
- Unified async strategy guidance across docs:
  - Default recommendation: `overflowStrategy: 'block'` to avoid log loss.
  - Throughput-first scenarios may use `overflowStrategy: 'drop'`.

## [v0.1.9] - 2026-03-23

### Fixed

- **Child logger shared FileManager**: `logger.child()` now shares the parent's `FileManager` instead of creating an independent writer. This prevents concurrent write conflicts when multiple child loggers target the same file path in the same process.
- **Compression ordering**: `maxFiles` count-based pruning is now deferred until _after_ compression completes, preventing active day-shards from being deleted before they are archived.
- **Existing archive preservation**: When compressing old log shards, any pre-existing `.log.gz` archive is merged with the new shards rather than overwritten. The original archive is restored automatically on compression failure.
- **Empty shard blank lines**: A shared `lastByte` state across source files caused spurious blank lines when empty shards were compressed. Each source file now gets its own `lastByte` reset.
- **Same-day shard sort stability**: `pruneFilesByCount()` previously had an unstable sort for shards sharing the same date, which could delete the current active file. The sort now uses `shardIndex` and `isCurrent` to guarantee the active file is always preserved.

### Added

- `ownsFileManager` flag on `Logger`: child loggers set this to `false` so `child.close()` does not shut down the shared writer.
- Process boundary documentation: README and `docs/production.md` now document multi-process write limitations and recommend per-process `filename` strategies.

### Changed

- Test suite expanded from 82 to **162 tests** across 9 suites.
- ESLint: replaced inline `require()` in test spies with top-level imports; annotated unavoidable `jest.isolateModules` `require()` with `eslint-disable` comments.

## [v0.1.4] - 2026-03-01

### Added

- Added English documentation as primary documentation.
- Performance metrics now tracks `filteredLogs`.
- `droppedLogs` now correctly includes logs dropped by filters.
- Enhanced file cleanup logic using filename dates instead of file modification times to handle compressed logs correctly.

### Changed

- Refactored `cleanupOldFiles` to use more accurate sorting and deletion criteria.
- Updated example files to use the unified `src/index.ts` entry point for better type safety.
- Optimized `safeStringify` performance for primitive data types.

### Fixed

- Fixed an issue where child loggers would not correctly inherit `retryCount` and `retryDelay` settings.
- Fixed a bug in `AsyncQueue` where stopping the queue during an active flush could result in lost logs.
- Fixed a duplicate property bug in `advanced-features-v2.ts` example.

## [v0.1.3] - 2026-02-28

### Added

- Log sampling support (`SamplingOptions`).
- Log rate limiting support (`RateLimitOptions`).
- Custom log filtering support (`FilterOptions`).
- Performance metrics tracking (`PerformanceMetrics`).

### Fixed

- Fixed browser console colors not showing correctly in some environments.
- Corrected file rotation logic when multiple log levels were used.

## [v0.1.2] - 2026-02-25

### Added

- Asynchronous batch writing support for Node.js (`AsyncWriteOptions`).
- Gzip compression for archived log files.
- Level change event notification.

### Changed

- Improved stack trace parsing performance by 40%.

## [v0.1.1] - 2026-02-20

### Added

- Initial stable release.
- Node.js file logging with size-based rotation.
- Browser console logging support.
- TypeScript definitions.
