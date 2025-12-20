/**
 * @chaeco/logger - 功能完整的日志模块
 *
 * @remarks
 * 支持 Node.js 和浏览器环境，提供多级别日志、彩色输出、文件写入、错误事件处理、
 * 日志采样、限流和日志收集服务等功能。
 *
 * @packageDocumentation
 */

export { Logger, logger } from './logger'
export type { 
  LogLevel, 
  LoggerOptions, 
  FileOptions, 
  ConsoleOptions, 
  LogEntry,
  SamplingOptions,
  RateLimitOptions,
  LoggerEventType,
  LoggerEventHandler,
  LoggerEvent,
  EnvironmentInfo,
  LoggerFilter,
  FilterOptions,
  PerformanceMetrics
} from './types'
export { isNodeEnvironment, isBrowserEnvironment, currentEnvironment, detectEnvironment } from './environment'
