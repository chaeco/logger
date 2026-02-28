# @chaeco/logger Changelog

All notable changes to this project will be documented in this file.

[更新日志 (Chinese Changelog)](CHANGELOG-zh.md)

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
