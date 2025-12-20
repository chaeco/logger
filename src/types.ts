/**
 * 日志等级类型
 * @remarks
 * - debug: 调试信息，最详细的日志级别
 * - info: 一般信息，用于记录正常的系统操作
 * - warn: 警告信息，表示潜在的问题
 * - error: 错误信息，表示系统出现错误
 * - silent: 静默模式，不输出任何日志
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent'

/**
 * Logger 配置选项
 */
export interface LoggerOptions {
  /** 日志等级，默认为 'info' */
  level?: LogLevel
  /** 文件输出配置 */
  file?: FileOptions
  /** 控制台输出配置 */
  console?: ConsoleOptions
  /** Logger 名称，用于区分不同的 logger 实例 */
  name?: string
  /** 日志采样配置 */
  sampling?: SamplingOptions
  /** 日志限流配置 */
  rateLimit?: RateLimitOptions
  /** 日志过滤器配置 */
  filter?: FilterOptions
}

/**
 * 文件输出配置选项
 */
export interface FileOptions {
  /** 是否启用文件输出，默认为 true */
  enabled?: boolean
  /** 日志文件存储路径，默认为 './logs' */
  path?: string
  /** 单个日志文件的最大大小，支持 'b', 'kb', 'mb', 'gb'，默认为 '10m' */
  maxSize?: string
  /** 最大保留的日志文件数量，默认为 30 */
  maxFiles?: number
  /** 日志文件名前缀，默认为 'app' */
  filename?: string
}

/**
 * 控制台输出配置选项
 */
export interface ConsoleOptions {
  /** 是否启用控制台输出，默认为 true */
  enabled?: boolean
  /** 是否启用彩色输出，默认为 true */
  colors?: boolean
  /** 是否显示时间戳，默认为 true */
  timestamp?: boolean
}

/**
 * 日志条目接口
 * @internal
 */
export interface LogEntry {
  /** 日志等级 */
  level: LogLevel
  /** 日志消息内容 */
  message: string
  /** 时间戳 */
  timestamp: string
  /** Logger 名称 */
  name?: string
  /** 调用者文件路径 */
  file?: string
  /** 调用者行号 */
  line?: number
  /** 附加数据 */
  data?: any
}

/**
 * 日志采样配置选项
 */
export interface SamplingOptions {
  /** 是否启用采样，默认为 false */
  enabled?: boolean
  /** 采样率，0-1 之间，例如 0.1 表示 10% 的日志被记录 */
  rate?: number
  /** 根据日志级别指定采样率 */
  rateByLevel?: {
    debug?: number
    info?: number
    warn?: number
    error?: number
    silent?: number
  }
}

/**
 * 日志限流配置选项
 */
export interface RateLimitOptions {
  /** 是否启用限流，默认为 false */
  enabled?: boolean
  /** 时间窗口大小（毫秒），默认为 1000 */
  windowSize?: number
  /** 时间窗口内的最大日志数 */
  maxLogsPerWindow?: number
  /** 超过限流时是否记录警告 */
  warnOnLimitExceeded?: boolean
}

/**
 * Logger 事件类型
 */
export type LoggerEventType = 'error' | 'fileWriteError' | 'rateLimitExceeded' | 'levelChange'

/**
 * Logger 事件处理程序
 */
export type LoggerEventHandler = (event: LoggerEvent) => void

/**
 * Logger 事件接口
 */
export interface LoggerEvent {
  /** 事件类型 */
  type: LoggerEventType
  /** 事件消息 */
  message: string
  /** 事件发生的时间戳 */
  timestamp: string
  /** 相关的错误对象（如果有） */
  error?: Error
  /** 事件的附加数据 */
  data?: any
}

/**
 * 环境信息接口
 * @internal
 */
export interface EnvironmentInfo {
  /** 运行环境：'node' 或 'browser' */
  environment: 'node' | 'browser'
  /** 是否支持文件写入 */
  supportsFileWrite: boolean
  /** 是否支持本地存储 */
  supportsLocalStorage: boolean
}

/**
 * 日志过滤器函数
 */
export type LoggerFilter = (entry: LogEntry) => boolean

/**
 * 日志过滤器配置选项
 */
export interface FilterOptions {
  /** 是否启用过滤 */
  enabled?: boolean
  /** 过滤函数列表 */
  filters?: LoggerFilter[]
  /** 匹配模式（all: 所有条件都满足，any: 任意条件满足） */
  mode?: 'all' | 'any'
}

/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
  /** 总日志数 */
  totalLogs: number
  /** 采样出的日志数 */
  sampledLogs: number
  /** 被限流丢弃的日志数 */
  droppedLogs: number
  /** 被过滤掉的日志数 */
  filteredLogs: number
  /** 平均日志处理时间（毫秒） */
  avgProcessingTime: number
  /** 文件写入次数（Node.js） */
  fileWrites: number
  /** 文件写入错误数 */
  fileWriteErrors: number
  /** 记录的时间戳 */
  timestamp: string
}
