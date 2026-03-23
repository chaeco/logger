# @chaeco/logger Changelog

All notable changes to this project will be documented in this file.

## [v0.1.9] - 2026-03-23

### Fixed
- **Child logger shared FileManager**: `logger.child()` now shares the parent's `FileManager` instead of creating an independent writer. This prevents concurrent write conflicts when multiple child loggers target the same file path in the same process.
- **Compression ordering**: `maxFiles` count-based pruning is now deferred until *after* compression completes, preventing active day-shards from being deleted before they are archived.
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
