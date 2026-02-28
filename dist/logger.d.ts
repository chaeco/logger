import { LogLevel, LoggerOptions, LoggerEventType, LoggerEventHandler, SamplingOptions, RateLimitOptions, FilterOptions, PerformanceMetrics, FormatOptions, ErrorHandlingOptions } from './types';
/**
 * Logger 类 - 支持多级别、彩色控制台、文件轮转、采样、限流和过滤。
 */
export declare class Logger {
    private level;
    private name?;
    private fileManager?;
    private consoleEnabled;
    private readonly isNodeEnv;
    private readonly isBrowserEnv;
    private readonly callerInfoHelper;
    private readonly formatter;
    private eventHandlers;
    private sampling;
    private rateLimit;
    /** O(1) 滑动窗口限流计数器 */
    private rlWindowStart;
    private rlWindowCount;
    private filter;
    private errorHandling;
    private metrics;
    /** Welford 在线均值样本数 */
    private metricsN;
    private readonly levelPriority;
    constructor(options?: LoggerOptions);
    /** 提前初始化（可选，首次写入时也会自动初始化） */
    init(): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    /** 动态修改日志等级 */
    setLevel(level: LogLevel): void;
    /** 获取当前日志等级 */
    getLevel(): LogLevel;
    configureSampling(options: SamplingOptions): void;
    configureRateLimit(options: RateLimitOptions): void;
    configureFilter(options: FilterOptions): void;
    configureFormat(options: FormatOptions): void;
    configureErrorHandling(options: ErrorHandlingOptions): void;
    updateConfig(options: Partial<LoggerOptions>): void;
    /** 注册事件处理器（error / fileWriteError / rateLimitExceeded / levelChange） */
    on(type: LoggerEventType, handler: LoggerEventHandler): void;
    /** 取消注册事件处理器 */
    off(type: LoggerEventType, handler: LoggerEventHandler): void;
    /** 创建继承父配置的子 Logger（名称格式：parent:child） */
    child(name: string): Logger;
    /** 获取性能指标快照 */
    getMetrics(): PerformanceMetrics;
    /** 重置所有性能指标 */
    resetMetrics(): void;
    /** 查询 IndexedDB 中的日志（仅浏览器环境） */
    queryStoredLogs(options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<Record<string, unknown>[]>;
    /** 清除 IndexedDB 中所有日志（仅浏览器环境） */
    clearStoredLogs(): Promise<void>;
    /** 关闭 Logger，刷新异步队列并释放资源 */
    close(): Promise<void>;
    private shouldLog;
    private shouldSample;
    /** O(1) 滑动窗口限流检查，无历史数组 */
    private checkRateLimit;
    private shouldPassFilter;
    private emitEvent;
    private createLogEntry;
    private writeToConsole;
    private writeToFile;
    private handleWriteError;
    private log;
}
/**
 * 默认 Logger 实例（name: 'app'，level: 'info'，写入 ./logs）
 */
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map