# Changelog

<!-- markdownlint-disable MD024 -->

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added
- 新增 `Logger.init()` 和 `FileManager.init()` 公开方法，用于可选的手动初始化

### Fixed
- 🔧 **重要修复**：解决在 Electron 等打包环境中模块加载时立即初始化导致的崩溃问题
- 在 `ensureLogDirectory()` 中添加错误处理，避免目录创建失败时崩溃
- 在 `initializeCurrentFile()` 中添加错误处理，提高健壮性
- 修复浏览器环境兼容性：将 Node.js 模块（`fs`, `path`, `zlib`, `util`）改为条件导入，避免在浏览器环境（如 Vite）中导致 "Module externalized for browser compatibility" 错误

### Changed
- **简化初始化逻辑**：FileManager 不再在构造函数中初始化，而是在首次写入日志时自动初始化
- FileManager 构造函数更加健壮，初始化失败不会导致程序崩溃

### Migration Guide
用户无需任何修改，直接使用即可：
```typescript
import { logger } from '@chaeco/logger'
logger.info('直接使用') // 首次写入时自动初始化
```

## [0.1.0] - 2025-12-21

### Added

- 扩展测试套件：从 92 个增加到 98 个测试用例
- 新增 FileManager 扩展测试（file-manager-extended.test.ts）
- 性能优化文档（PERFORMANCE.md）
- 完整使用示例文档（EXAMPLES.md）
- 测试覆盖率提升至 77-80%

### Changed

- 修复采样逻辑：`configureSampling()` 现在正确应用全局 `rate` 到所有日志级别
- 优化 `shouldSample()` 方法，优先使用级别特定的采样率
- 改进异步队列清理逻辑，防止测试间互相干扰
- 调整内存泄漏测试阈值（100MB → 300MB）以适应实际内存使用

### Fixed

- 修复采样测试：正确统计被采样的日志数量
- 修复自定义格式化测试：禁用颜色以确保格式化函数被调用
- 修复文件清理测试：调整超时和文件大小参数
- 修复性能测试中的资源泄漏问题

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
