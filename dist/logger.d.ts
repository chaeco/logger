import { LogLevel, LoggerOptions, LoggerEventType, LoggerEventHandler, SamplingOptions, RateLimitOptions, FilterOptions, PerformanceMetrics, FormatOptions, ErrorHandlingOptions } from './types';
/**
 * Logger 类 - 功能完整的日志记录器
 *
 * @remarks
 * Logger 提供了以下功能：
 * - 多级别日志支持 (DEBUG, INFO, WARN, ERROR)
 * - 彩色控制台输出
 * - 文件自动按日期分割
 * - 大文件自动分割
 * - 自动显示调用者文件和行号
 *
 * @example
 * ```typescript
 * // 使用默认实例
 * import { logger } from '@chaeco/logger'
 * logger.info('这是一条信息日志')
 *
 * // 创建自定义 logger
 * const customLogger = new Logger({
 *   level: 'debug',
 *   name: 'custom',
 *   file: {
 *     enabled: true,
 *     path: './logs',
 *     maxSize: '10m',
 *     maxFiles: 30
 *   }
 * })
 * ```
 */
export declare class Logger {
    private level;
    private name?;
    private fileManager?;
    private consoleEnabled;
    private consoleColors;
    private consoleTimestamp;
    private isNodeEnv;
    private isBrowserEnv;
    private eventHandlers;
    private sampling;
    private rateLimit;
    private rateLimitHistory;
    private callerInfoCache;
    private readonly maxCacheSize;
    private filter;
    private format;
    private errorHandling;
    private metrics;
    private processingTimes;
    private readonly maxMetricsHistory;
    private readonly levelPriority;
    /**
     * 创建 Logger 实例
     * @param options - Logger 配置选项
     */
    constructor(options?: LoggerOptions);
    private shouldLog;
    /**
     * 发出事件
     * @internal
     */
    private emitEvent;
    /**
     * 检查采样是否应该记录此日志
     * @internal
     */
    private shouldSample;
    /**
     * 检查限流是否应该记录此日志
     * @internal
     */
    private checkRateLimit;
    private getCallerInfo;
    /**
     * 简单的字符串哈希函数
     * @internal
     */
    private simpleHash;
    /**
     * 缓存调用者信息（LRU）
     * @internal
     */
    private cacheCallerInfo;
    private formatMessage;
    private formatConsoleMessage;
    private createLogEntry;
    private writeToConsole;
    private writeToFile;
    /**
     * 处理写入错误
     * @private
     */
    private handleWriteError;
    /**
     * 日志过滤检查
     * @internal
     */
    private shouldPassFilter;
    /**
     * 记录处理时间
     * @internal
     */
    private recordProcessingTime;
    private log;
    /**
     * 记录 DEBUG 级别日志
     * @param args - 日志参数，支持任意数量
     *
     * @example
     * ```typescript
     * logger.debug('调试信息', { userId: 123 })
     * logger.debug({ message: '调试信息', data: { key: 'value' } })
     * ```
     */
    debug(...args: any[]): void;
    /**
     * 记录 INFO 级别日志
     * @param args - 日志参数，支持任意数量
     *
     * @example
     * ```typescript
     * logger.info('用户登录成功', { username: 'john' })
     * logger.info({ message: '用户登录', userId: 123 })
     * ```
     */
    info(...args: any[]): void;
    /**
     * 记录 WARN 级别日志
     * @param args - 日志参数，支持任意数量
     *
     * @example
     * ```typescript
     * logger.warn('数据库连接慢', { latency: 1000 })
     * logger.warn(new Error('警告信息'), { context: 'db' })
     * ```
     */
    warn(...args: any[]): void;
    /**
     * 记录 ERROR 级别日志
     * @param args - 日志参数，支持任意数量
     *
     * @example
     * ```typescript
     * logger.error('数据库连接失败', { error: err.message })
     * logger.error(new Error('严重错误'), { userId: 123 })
     * ```
     */
    error(...args: any[]): void;
    /**
     * 创建子 Logger 实例
     * @param name - 子 Logger 的名称
     * @returns 新的 Logger 实例
     *
     * @remarks
     * 子 Logger 会继承父 Logger 的配置，并在名称中添加前缀
     *
     * @example
     * ```typescript
     * const dbLogger = logger.child('database')
     * dbLogger.info('连接成功') // 输出: [app:database] INFO 连接成功
     * ```
     */
    child(name: string): Logger;
    /**
     * 动态设置日志等级
     * @param level - 新的日志等级
     * @remarks
     * 此方法允许在运行时更改日志等级，无需重启应用
     *
     * @example
     * ```typescript
     * logger.setLevel('debug') // 切换到 DEBUG 等级
     * logger.debug('调试信息') // 现在会被记录
     * logger.setLevel('info') // 切换回 INFO 等级
     * ```
     */
    setLevel(level: LogLevel): void;
    /**
     * 获取当前日志等级
     * @returns 当前的日志等级
     */
    getLevel(): LogLevel;
    /**
     * 注册事件处理器
     * @param type - 事件类型
     * @param handler - 事件处理函数
     *
     * @remarks
     * 支持的事件类型：
     * - 'error': 日志系统发生错误
     * - 'fileWriteError': 文件写入失败
     * - 'rateLimitExceeded': 限流被触发
     * - 'levelChange': 日志等级被更改
     *
     * @example
     * ```typescript
     * logger.on('error', (event) => {
     *   console.error('日志错误:', event.message)
     * })
     *
     * logger.on('fileWriteError', (event) => {
     *   alert('日志文件写入失败!')
     * })
     *
     * logger.on('rateLimitExceeded', (event) => {
     *   console.warn('日志限流已触发')
     * })
     * ```
     */
    on(type: LoggerEventType, handler: LoggerEventHandler): void;
    /**
     * 取消注册事件处理器
     * @param type - 事件类型
     * @param handler - 要移除的事件处理函数
     *
     * @example
     * ```typescript
     * const handler = (event) => console.log(event)
     * logger.on('error', handler)
     * logger.off('error', handler)
     * ```
     */
    off(type: LoggerEventType, handler: LoggerEventHandler): void;
    /**
     * 配置日志采样
     * @param options - 采样配置选项
     *
     * @remarks
     * 采样可以减少高频日志的数量，有助于降低性能开销
     *
     * @example
     * ```typescript
     * // 启用采样，只记录 10% 的日志
     * logger.configureSampling({ enabled: true, rate: 0.1 })
     *
     * // 为不同等级的日志设置不同的采样率
     * logger.configureSampling({
     *   enabled: true,
     *   rateByLevel: {
     *     debug: 0.01,   // DEBUG 等级：1%
     *     info: 0.1,     // INFO 等级：10%
     *     warn: 0.5,     // WARN 等级：50%
     *     error: 1,      // ERROR 等级：100%
     *   }
     * })
     * ```
     */
    configureSampling(options: SamplingOptions): void;
    /**
     * 配置日志限流
     * @param options - 限流配置选项
     *
     * @remarks
     * 限流可以防止日志写入过快导致的性能问题或资源耗尽
     *
     * @example
     * ```typescript
     * // 启用限流，每秒最多 1000 条日志
     * logger.configureRateLimit({
     *   enabled: true,
     *   windowSize: 1000,           // 时间窗口为 1 秒
     *   maxLogsPerWindow: 1000,     // 每个窗口最多 1000 条日志
     *   warnOnLimitExceeded: true   // 触发限流时发出警告
     * })
     * ```
     */
    configureRateLimit(options: RateLimitOptions): void;
    /**
     * 获取当前环境信息
     * @returns 环境信息对象
     *
     * @remarks
     * 返回当前运行环境的信息，包括环境类型和功能支持情况。
     *
     * @example
     * ```typescript
     * const envInfo = logger.getEnvironmentInfo()
     * console.log(envInfo.environment)        // 'node' 或 'browser'
     * console.log(envInfo.supportsFileWrite)  // 是否支持文件写入
     * ```
     */
    getEnvironmentInfo(): {
        environment: string;
        supportsFileWrite: boolean;
        supportsLocalStorage: boolean;
    };
    /**
     * 配置日志过滤器
     * @param options - 过滤器配置选项
     *
     * @remarks
     * 日志过滤器可以根据条件决定是否记录日志，可用于禁用特定来源或级别的日志。
     *
     * @example
     * ```typescript
     * // 启用过滤器，只记录来自特定模块的日志
     * logger.configureFilter({
     *   enabled: true,
     *   filters: [
     *     (entry) => entry.name?.includes('api') || entry.level === 'error'
     *   ],
     *   mode: 'any' // 匹配任意条件
     * })
     * ```
     */
    configureFilter(options: FilterOptions): void;
    /**
     * 配置日志格式化选项
     * @param options - 格式化配置选项
     *
     * @example
     * ```typescript
     * // JSON 格式输出
     * logger.configureFormat({
     *   json: true,
     *   jsonIndent: 2
     * })
     *
     * // 自定义格式化函数
     * logger.configureFormat({
     *   enabled: true,
     *   formatter: (entry) => `${entry.level}: ${entry.message}`
     * })
     * ```
     */
    configureFormat(options: FormatOptions): void;
    /**
     * 配置错误处理选项
     * @param options - 错误处理配置选项
     *
     * @example
     * ```typescript
     * logger.configureErrorHandling({
     *   silent: false,  // 抛出异常
     *   onError: (error, context) => {
     *     console.error('Logger error:', error, context)
     *   }
     * })
     * ```
     */
    configureErrorHandling(options: ErrorHandlingOptions): void;
    /**
     * 获取性能指标
     * @returns 当前的性能指标对象
     *
     * @remarks
     * 返回日志系统的性能数据，包括处理时间、缓存大小、错误数等。
     *
     * @example
     * ```typescript
     * const metrics = logger.getMetrics()
     * console.log(metrics.totalLogs)        // 总日志数
     * console.log(metrics.avgProcessingTime) // 平均处理时间
     * console.log(metrics.collectorUploads) // 上传次数
     * ```
     */
    getMetrics(): PerformanceMetrics;
    /**
     * 重置性能指标
     *
     * @remarks
     * 清除所有累积的性能指标数据。
     *
     * @example
     * ```typescript
     * logger.resetMetrics()
     * // 开始新的测量周期
     * ```
     */
    resetMetrics(): void;
    /**
     * 订阅 Logger 事件
     * @param eventType - 事件类型
     * @param handler - 事件处理程序
     *
     * @remarks
     * Logger 会触发以下事件：
     * - 'error': Logger 内部发生错误
     * - 'fileWriteError': 文件写入失败
     * - 'rateLimitExceeded': 超过限流限制
     * - 'levelChange': 日志级别被改变
     *
     * @example
     * ```typescript
     * logger.on('error', (event) => {
     *   console.error('Logger error:', event.message, event.error)
     * })
     *
     * logger.on('rateLimitExceeded', (event) => {
     *   console.warn('Rate limit exceeded:', event.message)
     * })
     * ```
     */
    /**
     * 更新 Logger 配置
     * @param options - 新的配置选项
     *
     * @remarks
     * 可以在运行时动态更新 Logger 的配置，已经记录的日志不会受到影响。
     *
     * @example
     * ```typescript
     * logger.updateConfig({ level: 'debug' })
     * ```
     */
    updateConfig(options: Partial<LoggerOptions>): void;
    /**
     * 从浏览器 IndexedDB 查询存储的日志
     * @param options - 查询选项
     * @returns 日志条目数组
     *
     * @remarks
     * 仅在浏览器环境中可用。使用 @chaeco/indexed-db-storage 作为存储后端。
     *
     * @example
     * ```typescript
     * // 查询最近的日志
     * const recentLogs = await logger.queryStoredLogs()
     *
     * // 查询特定日期的日志
     * const logs = await logger.queryStoredLogs({
     *   limit: 50,
     *   date: '2024-12-21'
     * })
     * ```
     */
    queryStoredLogs(options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<Record<string, unknown>[]>;
    /**
     * 清除浏览器 IndexedDB 中的所有存储日志
     *
     * @remarks
     * 仅在浏览器环境中可用。这会删除所有通过 IndexedDB 存储的日志。
     *
     * @example
     * ```typescript
     * // 清除所有存储的日志
     * await logger.clearStoredLogs()
     * console.log('所有日志已清除')
     * ```
     */
    clearStoredLogs(): Promise<void>;
    /**
     * 关闭 Logger 并刷新队列
     *
     * @remarks
     * 调用此方法来清理资源、刷新异步写入队列并关闭文件管理器。
     * 在应用程序退出前调用此方法以确保所有日志都被写入。
     *
     * @example
     * ```typescript
     * // 程序退出前关闭 logger
     * process.on('SIGINT', async () => {
     *   await logger.close()
     *   process.exit(0)
     * })
     * ```
     */
    close(): Promise<void>;
}
/**
 * 默认 Logger 实例
 *
 * @remarks
 * 这是一个预配置的 Logger 实例，可以直接使用。
 * 配置：
 * - 名称: 'app'
 * - 日志级别: 'info'
 * - 文件路径: './logs'
 * - 最大文件大小: 10MB
 * - 最大文件数: 30
 *
 * @example
 * ```typescript
 * import { logger } from '@chaeco/logger'
 * logger.info('应用启动')
 * logger.error('发生错误', { error: err })
 * ```
 */
export declare const logger: Logger;
//# sourceMappingURL=logger.d.ts.map