/**
 * 日志等级类型
 * @remarks
 * - debug: 调试信息，最详细的日志级别
 * - info: 一般信息，用于记录正常的系统操作
 * - warn: 警告信息，表示潜在的问题
 * - error: 错误信息，表示系统出现错误
 * - silent: 静默模式，不输出任何日志
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';
/**
 * Logger 配置选项
 */
export interface LoggerOptions {
    /** 日志等级，默认为 'info' */
    level?: LogLevel;
    /** 文件输出配置 */
    file?: FileOptions;
    /** 控制台输出配置 */
    console?: ConsoleOptions;
    /** Logger 名称，用于区分不同的 logger 实例 */
    name?: string;
    /** 日志采样配置 */
    sampling?: SamplingOptions;
    /** 日志限流配置 */
    rateLimit?: RateLimitOptions;
    /** 日志过滤器配置 */
    filter?: FilterOptions;
    /** 日志格式化配置 */
    format?: FormatOptions;
    /** 异步写入配置（Node.js） */
    async?: AsyncWriteOptions;
    /** 错误处理配置 */
    errorHandling?: ErrorHandlingOptions;
}
/**
 * 文件输出配置选项
 */
export interface FileOptions {
    /** 是否启用文件输出，默认为 true */
    enabled?: boolean;
    /** 日志文件存储路径，默认为 './logs' */
    path?: string;
    /** 单个日志文件的最大大小（字节），默认为 10485760（10 MB） */
    maxSize?: number;
    /** 最大保留的日志文件数量，默认为 30 */
    maxFiles?: number;
    /** 日志文件名前缀，默认为 'app' */
    filename?: string;
    /** 日志文件最大保留天数，超过该天数的日志将被自动删除，默认为 30 天 */
    maxAge?: number;
    /** 是否压缩旧的日志文件（gzip），默认为 false */
    compress?: boolean;
    /** 写入失败时的重试次数，默认为 3 */
    retryCount?: number;
    /** 重试间隔基数（毫秒），实际延迟为 retryDelay * attempt，默认为 100 */
    retryDelay?: number;
}
/**
 * 控制台输出配置选项
 */
export interface ConsoleOptions {
    /** 是否启用控制台输出，默认为 true */
    enabled?: boolean;
    /** 是否启用彩色输出，默认为 true */
    colors?: boolean;
    /** 是否显示时间戳，默认为 true */
    timestamp?: boolean;
}
/**
 * 日志条目接口
 * @internal
 */
export interface LogEntry {
    /** 日志等级 */
    level: LogLevel;
    /** 日志消息内容 */
    message: string;
    /** 时间戳 */
    timestamp: string;
    /** Logger 名称 */
    name?: string;
    /** 调用者文件路径 */
    file?: string;
    /** 调用者行号 */
    line?: number;
    /** 附加数据 */
    data?: any;
}
/**
 * 日志采样配置选项
 */
export interface SamplingOptions {
    /** 是否启用采样，默认为 false */
    enabled?: boolean;
    /** 采样率，0-1 之间，例如 0.1 表示 10% 的日志被记录 */
    rate?: number;
    /** 根据日志级别指定采样率 */
    rateByLevel?: {
        debug?: number;
        info?: number;
        warn?: number;
        error?: number;
        silent?: number;
    };
}
/**
 * 日志限流配置选项
 */
export interface RateLimitOptions {
    /** 是否启用限流，默认为 false */
    enabled?: boolean;
    /** 时间窗口大小（毫秒），默认为 1000 */
    windowSize?: number;
    /** 时间窗口内的最大日志数 */
    maxLogsPerWindow?: number;
    /** 超过限流时是否记录警告 */
    warnOnLimitExceeded?: boolean;
}
/**
 * Logger 事件类型
 */
export type LoggerEventType = 'error' | 'fileWriteError' | 'rateLimitExceeded' | 'levelChange';
/**
 * Logger 事件处理程序
 */
export type LoggerEventHandler = (event: LoggerEvent) => void;
/**
 * Logger 事件接口
 */
export interface LoggerEvent {
    /** 事件类型 */
    type: LoggerEventType;
    /** 事件消息 */
    message: string;
    /** 事件发生的时间戳 */
    timestamp: string;
    /** 相关的错误对象（如果有） */
    error?: Error;
    /** 事件的附加数据 */
    data?: any;
}
/**
 * 日志过滤器函数
 */
export type LoggerFilter = (entry: LogEntry) => boolean;
/**
 * 日志过滤器配置选项
 */
export interface FilterOptions {
    /** 是否启用过滤 */
    enabled?: boolean;
    /** 过滤函数列表 */
    filters?: LoggerFilter[];
    /** 匹配模式（all: 所有条件都满足，any: 任意条件满足） */
    mode?: 'all' | 'any';
}
/**
 * 性能指标接口
 */
export interface PerformanceMetrics {
    /** 总日志数 */
    totalLogs: number;
    /** 因采样率不满足而被跳过的日志数（即"采样丢弃数"）。
     *  字段名 sampledLogs 保留以维持向后兼容，语义等同于 sampleDroppedLogs。 */
    sampledLogs: number;
    /** 所有被丢弃的日志总数（= 采样丢弃 + 限流丢弃 + 过滤丢弃），满足 totalLogs - droppedLogs = 实际写出条数 */
    droppedLogs: number;
    /** 被过滤掉的日志数 */
    filteredLogs: number;
    /** 平均日志处理时间（毫秒） */
    avgProcessingTime: number;
    /** 文件写入尝试次数（含最终失败的写入，Node.js 环境下统计） */
    fileWrites: number;
    /** 文件写入错误数 */
    fileWriteErrors: number;
    /** 记录的时间戳 */
    timestamp: string;
}
/**
 * 日志格式化配置选项
 */
export interface FormatOptions {
    /** 是否启用自定义 formatter 函数，默认为 false。
     *  仅控制 `formatter` 函数是否生效；`json` 模式独立工作，不受此开关影响 */
    enabled?: boolean;
    /** 日期时间格式，默认为 'YYYY-MM-DD HH:mm:ss.SSS' */
    timestampFormat?: string;
    /** 自定义格式化函数 */
    formatter?: (entry: LogEntry) => string;
    /** 是否包含调用栈信息，默认为 true */
    includeStack?: boolean;
    /** 是否包含 logger 名称，默认为 true */
    includeName?: boolean;
    /** JSON 格式输出，默认为 false */
    json?: boolean;
    /** JSON 缩进空格数（仅当 json=true 时生效），0 表示不缩进 */
    jsonIndent?: number;
}
/**
 * 异步写入配置选项（Node.js）
 */
export interface AsyncWriteOptions {
    /** 是否启用异步写入，默认为 false */
    enabled?: boolean;
    /** 写入队列最大长度，默认为 1000 */
    queueSize?: number;
    /** 批量写入的最大条数，默认为 100 */
    batchSize?: number;
    /** 批量写入的最大等待时间（毫秒），默认为 1000 */
    flushInterval?: number;
    /** 队列满时的处理策略：'drop'（丢弃新消息）、'block'（等待当前批次写完再继续）、
     *  'overflow'（当前与 'block' 等效：等待写完后继续；未来可扩展为独立溢出队列） */
    overflowStrategy?: 'drop' | 'block' | 'overflow';
}
/**
 * 错误处理配置选项
 */
export interface ErrorHandlingOptions {
    /** 是否静默错误：true（默认）→ 抑制所有 stderr 输出，仅通过 onError 回调和事件通知；
     *  false → 与 fallbackToConsole 协同：当 fallbackToConsole:true 时输出 console.error */
    silent?: boolean;
    /** 错误回调函数 */
    onError?: (error: Error, context: string) => void;
    /** 是否在错误时降级到控制台输出，默认为 true */
    fallbackToConsole?: boolean;
}
//# sourceMappingURL=types.d.ts.map