/**
 * @chaeco/logger - 功能完整的日志模块
 *
 * @remarks
 * 支持 Node.js 和浏览器环境，提供多级别日志、彩色输出、文件写入、错误事件处理、
 * 日志采样、限流和日志收集服务等功能。
 *
 * @packageDocumentation
 */
import { Logger } from './core/logger';
export { Logger };
/**
 * 默认 Logger 实例（name: 'app'，level: 'info'，写入 ./logs）
 */
export declare const logger: Logger;
export type { LogLevel, LoggerOptions, FileOptions, ConsoleOptions, LogEntry, SamplingOptions, RateLimitOptions, LoggerEventType, LoggerEventHandler, LoggerEvent, EnvironmentInfo, LoggerFilter, FilterOptions, PerformanceMetrics } from './core/types';
export { isNodeEnvironment, isBrowserEnvironment, currentEnvironment, detectEnvironment } from './utils/environment';
//# sourceMappingURL=index.d.ts.map