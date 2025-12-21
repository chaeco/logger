# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.0.3] - 2025-12-21

### Added
- 异步写入队列功能，支持批量写入和多种溢出策略
- 自定义格式化功能，支持 JSON 输出和自定义格式化函数
- 错误重试机制，支持自定义重试次数和延迟
- `configureFormat()` 方法用于动态配置格式化
- `configureErrorHandling()` 方法用于配置错误处理
- `getQueueStatus()` 方法用于查询异步队列状态

### Changed
- 优化文件写入流程，支持异步批量写入
- 改进错误处理逻辑，支持降级和重试

### Fixed
- 修复文件写入失败时的错误处理

## [0.0.2] - 2025-12-21

### Added
- 自动清理功能：通过 `maxAge` 配置自动删除过期日志
- 日志压缩功能：通过 `compress` 配置自动压缩旧日志（Node.js）
- 支持按时间和数量双重策略清理日志文件

### Changed
- 优化文件清理逻辑
- IndexedDB 配置支持 `maxAge` 设置

### Fixed
- 无

## [0.0.1] - 2025-12-21

### Added
- 初始发布
- 跨平台支持（Node.js + 浏览器）
- 5 个日志级别（debug/info/warn/error/silent）
- 文件自动分割和 IndexedDB 存储
- 日志采样、限流、过滤功能
- 性能监控和事件系统
- 完整的 TypeScript 支持
- 自动显示调用者文件和行号
- 彩色控制台输出

[Unreleased]: https://github.com/chaeco/logger/compare/v0.0.2...HEAD
[0.0.2]: https://github.com/chaeco/logger/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/chaeco/logger/releases/tag/v0.0.1
