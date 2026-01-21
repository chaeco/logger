"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
const color_utils_1 = require("./color-utils");
const file_manager_1 = require("./file-manager");
const environment_1 = require("./environment");
const dayjs_1 = __importDefault(require("dayjs"));
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
class Logger {
    /**
     * 创建 Logger 实例
     * @param options - Logger 配置选项
     */
    constructor(options = {}) {
        // 环境信息
        this.isNodeEnv = environment_1.isNodeEnvironment;
        this.isBrowserEnv = environment_1.isBrowserEnvironment;
        // 事件处理
        this.eventHandlers = new Map();
        // 采样配置
        this.sampling = {
            enabled: false,
            rate: 1,
            rateByLevel: { debug: 1, info: 1, warn: 1, error: 1, silent: 1 }
        };
        // 限流配置
        this.rateLimit = {
            enabled: false,
            windowSize: 1000,
            maxLogsPerWindow: 1000,
            warnOnLimitExceeded: true
        };
        // 限流追踪
        this.rateLimitHistory = [];
        // 堆栈解析缓存（LRU）
        this.callerInfoCache = new Map();
        this.maxCacheSize = 1000;
        // 日志过滤器
        this.filter = {
            enabled: false,
            filters: [],
            mode: 'all'
        };
        // 日志格式化配置
        this.format = {
            enabled: false,
            timestampFormat: 'YYYY-MM-DD HH:mm:ss.SSS',
            formatter: undefined,
            includeStack: true,
            includeName: true,
            json: false,
            jsonIndent: 0,
        };
        // 错误处理配置
        this.errorHandling = {
            silent: true,
            onError: undefined,
            retryCount: 3,
            retryDelay: 100,
            fallbackToConsole: true,
        };
        // 性能指标
        this.metrics = {
            totalLogs: 0,
            sampledLogs: 0,
            droppedLogs: 0,
            filteredLogs: 0,
            avgProcessingTime: 0,
            fileWrites: 0,
            fileWriteErrors: 0,
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
        };
        this.processingTimes = [];
        this.maxMetricsHistory = 100;
        this.levelPriority = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            silent: 999,
        };
        this.level = options.level ?? 'info';
        if (options.name) {
            this.name = options.name;
        }
        // 文件输出配置 - 仅在 Node.js 环境中启用
        if (this.isNodeEnv && options.file?.enabled !== false) {
            this.fileManager = new file_manager_1.FileManager(options.file, options.async);
        }
        else if (this.isBrowserEnv && options.file?.enabled) {
            // 浏览器环境中启用 IndexedDB 存储
            this.fileManager = new file_manager_1.FileManager(options.file, options.async);
        }
        // 控制台输出配置
        this.consoleEnabled = options.console?.enabled ?? true;
        this.consoleColors = options.console?.colors ?? (this.isNodeEnv ? true : false);
        this.consoleTimestamp = options.console?.timestamp ?? true;
        // 采样配置
        if (options.sampling) {
            this.sampling = {
                enabled: options.sampling.enabled ?? false,
                rate: options.sampling.rate ?? 1,
                rateByLevel: {
                    debug: options.sampling.rateByLevel?.debug ?? 1,
                    info: options.sampling.rateByLevel?.info ?? 1,
                    warn: options.sampling.rateByLevel?.warn ?? 1,
                    error: options.sampling.rateByLevel?.error ?? 1,
                    silent: options.sampling.rateByLevel?.silent ?? 1,
                }
            };
        }
        // 限流配置
        if (options.rateLimit) {
            this.rateLimit = {
                enabled: options.rateLimit.enabled ?? false,
                windowSize: options.rateLimit.windowSize ?? 1000,
                maxLogsPerWindow: options.rateLimit.maxLogsPerWindow ?? 1000,
                warnOnLimitExceeded: options.rateLimit.warnOnLimitExceeded ?? true,
            };
        }
        // 日志过滤配置
        if (options.filter) {
            this.filter = {
                enabled: options.filter.enabled ?? false,
                filters: options.filter.filters ?? [],
                mode: options.filter.mode ?? 'all'
            };
        }
        // 日志格式化配置
        if (options.format) {
            this.format = {
                enabled: options.format.enabled ?? false,
                timestampFormat: options.format.timestampFormat ?? 'YYYY-MM-DD HH:mm:ss.SSS',
                formatter: options.format.formatter,
                includeStack: options.format.includeStack ?? true,
                includeName: options.format.includeName ?? true,
                json: options.format.json ?? false,
                jsonIndent: options.format.jsonIndent ?? 0,
            };
        }
        // 错误处理配置
        if (options.errorHandling) {
            this.errorHandling = {
                silent: options.errorHandling.silent ?? true,
                onError: options.errorHandling.onError,
                retryCount: options.errorHandling.retryCount ?? 3,
                retryDelay: options.errorHandling.retryDelay ?? 100,
                fallbackToConsole: options.errorHandling.fallbackToConsole ?? true,
            };
        }
    }
    shouldLog(level) {
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }
    /**
     * 发出事件
     * @internal
     */
    emitEvent(type, message, error, ...args) {
        const data = args.length === 1 ? args[0] : args.length > 1 ? args : undefined;
        const handlers = this.eventHandlers.get(type);
        if (!handlers || handlers.length === 0)
            return;
        const event = {
            type,
            message,
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
            error,
            data,
        };
        handlers.forEach(handler => {
            try {
                handler(event);
            }
            catch (err) {
                // 避免事件处理器错误影响日志系统
                console.error('Error in logger event handler:', err);
            }
        });
    }
    /**
     * 检查采样是否应该记录此日志
     * @internal
     */
    shouldSample(level) {
        if (!this.sampling.enabled)
            return true;
        // 先尝试使用该级别的采样率，如果没设置则使用全局rate
        const rate = this.sampling.rateByLevel[level] ?? this.sampling.rate;
        return Math.random() < rate;
    }
    /**
     * 检查限流是否应该记录此日志
     * @internal
     */
    checkRateLimit() {
        if (!this.rateLimit.enabled)
            return true;
        const now = Date.now();
        const windowStart = now - this.rateLimit.windowSize;
        // 清理过期的记录
        this.rateLimitHistory = this.rateLimitHistory.filter(item => item.timestamp > windowStart);
        // 计算当前窗口内的日志总数
        const currentCount = this.rateLimitHistory.reduce((sum, item) => sum + item.count, 0);
        if (currentCount >= this.rateLimit.maxLogsPerWindow) {
            if (this.rateLimit.warnOnLimitExceeded) {
                this.emitEvent('rateLimitExceeded', `日志限流已触发: ${currentCount}/${this.rateLimit.maxLogsPerWindow} 日志在 ${this.rateLimit.windowSize}ms 内`);
            }
            return false;
        }
        // 记录此日志
        const lastItem = this.rateLimitHistory[this.rateLimitHistory.length - 1];
        if (lastItem && lastItem.timestamp === now) {
            lastItem.count++;
        }
        else {
            this.rateLimitHistory.push({ timestamp: now, count: 1 });
        }
        return true;
    }
    getCallerInfo() {
        const error = new Error();
        const stack = error.stack;
        if (!stack)
            return {};
        // 尝试从缓存获取（使用堆栈的哈希作为键）
        const stackHash = this.simpleHash(stack);
        if (this.callerInfoCache.has(stackHash)) {
            return this.callerInfoCache.get(stackHash) || {};
        }
        // 解析堆栈信息
        const stackLines = stack.split('\n');
        let skipCount = 0;
        for (let i = 0; i < stackLines.length; i++) {
            const line = stackLines[i]?.trim();
            if (!line)
                continue;
            // 跳过Error本身的行
            if (line.startsWith('Error'))
                continue;
            // 跳过logger内部的方法调用
            if (line.includes('Logger.log') ||
                line.includes('Logger.info') ||
                line.includes('Logger.warn') ||
                line.includes('Logger.error') ||
                line.includes('Logger.debug') ||
                line.includes('getCallerInfo')) {
                skipCount++;
                continue;
            }
            // 跳过前几个内部调用
            if (skipCount < 2) {
                skipCount++;
                continue;
            }
            // 匹配文件路径和行号
            const match = line.match(/\((.+?):(\d+):\d+\)$/) || line.match(/at (.+?):(\d+):\d+$/);
            if (match && match[1] && match[2]) {
                const filePath = match[1];
                const lineNumber = parseInt(match[2], 10);
                // 排除Node.js内部文件和logger模块文件
                if (filePath &&
                    !filePath.includes('/plugins/logger/') &&
                    !filePath.includes('\\plugins\\logger\\') &&
                    !filePath.includes('node:internal') &&
                    !filePath.includes('node_modules') &&
                    !filePath.startsWith('node:')) {
                    // 简化文件路径，只保留相对路径
                    let simplifiedPath = filePath;
                    if (filePath.includes('/mflix-api/')) {
                        simplifiedPath = filePath.split('/mflix-api/')[1] || filePath;
                    }
                    else if (filePath.includes('\\mflix-api\\')) {
                        simplifiedPath = filePath.split('\\mflix-api\\')[1] || filePath;
                    }
                    const result = {
                        file: simplifiedPath,
                        line: lineNumber,
                    };
                    // 缓存结果（实现 LRU）
                    this.cacheCallerInfo(stackHash, result);
                    return result;
                }
            }
        }
        return {};
    }
    /**
     * 简单的字符串哈希函数
     * @internal
     */
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return Math.abs(hash).toString(36);
    }
    /**
     * 缓存调用者信息（LRU）
     * @internal
     */
    cacheCallerInfo(key, info) {
        // 如果缓存已满，删除最旧的项
        if (this.callerInfoCache.size >= this.maxCacheSize) {
            const firstKey = this.callerInfoCache.keys().next().value;
            if (firstKey !== undefined) {
                this.callerInfoCache.delete(firstKey);
            }
        }
        this.callerInfoCache.set(key, info);
    }
    /**
     * 安全的JSON序列化 - 处理循环引用
     * @internal
     */
    safeStringify(obj, indent) {
        try {
            const seen = new WeakSet();
            return JSON.stringify(obj, (key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value)) {
                        return '[Circular]';
                    }
                    seen.add(value);
                }
                return value;
            }, indent);
        }
        catch (error) {
            // 如果仍然序列化失败，返回对象的字符串表示
            try {
                return String(obj);
            }
            catch {
                return '[Unable to serialize]';
            }
        }
    }
    formatMessage(entry) {
        // 使用自定义格式化函数
        if (this.format.enabled && this.format.formatter) {
            try {
                return this.format.formatter(entry);
            }
            catch (error) {
                console.error('Error in custom formatter:', error);
                // 降级到默认格式
            }
        }
        // JSON 格式输出
        if (this.format.json) {
            const jsonEntry = {
                timestamp: entry.timestamp,
                level: entry.level,
                message: entry.message,
            };
            if (this.format.includeName && entry.name) {
                jsonEntry.name = entry.name;
            }
            if (this.format.includeStack && entry.file && entry.line) {
                jsonEntry.file = entry.file;
                jsonEntry.line = entry.line;
            }
            if (entry.data) {
                jsonEntry.data = entry.data;
            }
            return this.safeStringify(jsonEntry, this.format.jsonIndent);
        }
        // 默认格式
        const parts = [];
        // 使用配置的时间戳格式
        if (this.consoleTimestamp) {
            const timestamp = (0, dayjs_1.default)(entry.timestamp).format(this.format.timestampFormat);
            parts.push(`[${timestamp}]`);
        }
        if (this.format.includeName && entry.name) {
            parts.push(`[${entry.name}]`);
        }
        parts.push(entry.level.toUpperCase().padEnd(5));
        // 添加文件和行号信息
        if (this.format.includeStack && entry.file && entry.line) {
            parts.push(`${entry.file}:${entry.line}`);
        }
        parts.push(entry.message);
        // 添加附加数据
        if (entry.data) {
            parts.push(this.safeStringify(entry.data));
        }
        return parts.join(' ');
    }
    formatConsoleMessage(entry) {
        if (!this.consoleColors) {
            return this.formatMessage(entry);
        }
        const parts = [];
        if (this.consoleTimestamp) {
            parts.push(color_utils_1.ColorUtils.colorizeTimestamp(`[${entry.timestamp}]`));
        }
        if (entry.name) {
            parts.push(color_utils_1.ColorUtils.colorizeName(entry.name));
        }
        parts.push(color_utils_1.ColorUtils.colorizeLevel(entry.level));
        // 添加文件和行号信息
        if (entry.file && entry.line) {
            parts.push(color_utils_1.ColorUtils.colorizeFileLocation(`${entry.file}:${entry.line}`));
        }
        parts.push(color_utils_1.ColorUtils.colorizeMessage(entry.level, entry.message));
        // 添加附加数据
        if (entry.data) {
            parts.push(this.safeStringify(entry.data));
        }
        return parts.join(' ');
    }
    createLogEntry(level, message, data) {
        const callerInfo = this.getCallerInfo();
        const entry = {
            level,
            message: typeof message === 'string' ? message : this.safeStringify(message),
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
            data,
        };
        if (this.name) {
            entry.name = this.name;
        }
        if (callerInfo.file) {
            entry.file = callerInfo.file;
        }
        if (callerInfo.line) {
            entry.line = callerInfo.line;
        }
        return entry;
    }
    writeToConsole(entry) {
        if (!this.consoleEnabled)
            return;
        const formattedMessage = this.formatConsoleMessage(entry);
        const output = entry.level === 'error' ? console.error : console.log;
        output(formattedMessage);
    }
    writeToFile(entry) {
        if (!this.fileManager)
            return;
        const formattedMessage = this.formatMessage(entry);
        try {
            // 异步写入日志，但不阻塞同步执行
            const writePromise = this.fileManager.write(formattedMessage);
            if (writePromise instanceof Promise) {
                writePromise.catch((error) => {
                    this.handleWriteError(error, formattedMessage, entry);
                });
            }
            this.metrics.fileWrites++;
        }
        catch (error) {
            this.handleWriteError(error, formattedMessage, entry);
        }
    }
    /**
     * 处理写入错误
     * @private
     */
    handleWriteError(error, message, entry) {
        this.metrics.fileWriteErrors++;
        const err = error instanceof Error ? error : new Error(String(error));
        // 调用自定义错误处理器
        if (this.errorHandling.onError) {
            try {
                this.errorHandling.onError(err, 'file_write');
            }
            catch (handlerError) {
                console.error('Error in error handler:', handlerError);
            }
        }
        // 发送错误事件
        this.emitEvent('fileWriteError', `文件写入失败: ${message}`, err);
        // 降级到控制台输出
        if (this.errorHandling.fallbackToConsole && entry) {
            console.error('[Logger Fallback]', this.formatConsoleMessage(entry));
        }
        // 如果不是静默模式，抛出错误
        if (!this.errorHandling.silent) {
            throw err;
        }
    }
    /**
     * 日志过滤检查
     * @internal
     */
    shouldPassFilter(entry) {
        if (!this.filter.enabled || this.filter.filters.length === 0) {
            return true;
        }
        const results = this.filter.filters.map((filter) => {
            try {
                return filter(entry);
            }
            catch (error) {
                console.error('Error in log filter:', error);
                return true;
            }
        });
        // 根据模式返回结果
        if (this.filter.mode === 'all') {
            return results.every((r) => r);
        }
        else {
            return results.some((r) => r);
        }
    }
    /**
     * 记录处理时间
     * @internal
     */
    recordProcessingTime(time) {
        this.processingTimes.push(time);
        if (this.processingTimes.length > this.maxMetricsHistory) {
            this.processingTimes.shift();
        }
        // 更新平均处理时间
        this.metrics.avgProcessingTime =
            this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length;
    }
    log(level, ...args) {
        // 解析参数：第一个参数如果是字符串当作消息，否则当作数据
        let message;
        let data;
        if (args.length === 0) {
            message = '';
            data = undefined;
        }
        else if (typeof args[0] === 'string') {
            message = args[0];
            data = args.length === 2 ? args[1] : args.length > 2 ? args.slice(1) : undefined;
        }
        else if (args[0] instanceof Error) {
            // 特殊处理Error对象
            message = args[0].message || args[0].toString();
            data = args.length === 1 ? undefined : { error: args[0], additionalData: args.slice(1) };
        }
        else {
            message = '';
            data = args.length === 1 ? args[0] : args;
        }
        const startTime = performance.now();
        if (!this.shouldLog(level))
            return;
        // 记录总日志数（包括被采样和限流的）
        this.metrics.totalLogs++;
        // 采样检查
        if (!this.shouldSample(level)) {
            this.metrics.sampledLogs++;
            this.metrics.droppedLogs++;
            return;
        }
        // 限流检查
        if (!this.checkRateLimit()) {
            this.metrics.droppedLogs++;
            return;
        }
        const entry = this.createLogEntry(level, message, data);
        // 日志过滤
        if (this.filter.enabled && !this.shouldPassFilter(entry)) {
            this.metrics.filteredLogs++;
            return;
        }
        this.writeToConsole(entry);
        this.writeToFile(entry);
        // 记录处理时间
        const processingTime = performance.now() - startTime;
        this.recordProcessingTime(processingTime);
    }
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
    debug(...args) {
        this.log('debug', ...args);
    }
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
    info(...args) {
        this.log('info', ...args);
    }
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
    warn(...args) {
        this.log('warn', ...args);
    }
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
    error(...args) {
        this.log('error', ...args);
    }
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
    child(name) {
        const childOptions = {
            level: this.level,
            name: this.name ? `${this.name}:${name}` : name,
            console: {
                enabled: this.consoleEnabled,
                colors: this.consoleColors,
                timestamp: this.consoleTimestamp,
            },
            sampling: { ...this.sampling },
            rateLimit: { ...this.rateLimit },
        };
        if (this.fileManager) {
            // FileManager 的 options 是私有的，但我们需要访问以传递给子 Logger
            const fm = this.fileManager;
            childOptions.file = {
                enabled: true,
                path: fm.options.path,
                maxSize: fm.options.maxSize,
                maxFiles: fm.options.maxFiles,
                filename: fm.options.filename,
            };
        }
        return new Logger(childOptions);
    }
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
    setLevel(level) {
        const oldLevel = this.level;
        this.level = level;
        this.emitEvent('levelChange', `日志等级已从 ${oldLevel} 更改为 ${level}`, undefined, { oldLevel, newLevel: level });
    }
    /**
     * 获取当前日志等级
     * @returns 当前的日志等级
     */
    getLevel() {
        return this.level;
    }
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
    on(type, handler) {
        if (!this.eventHandlers.has(type)) {
            this.eventHandlers.set(type, []);
        }
        this.eventHandlers.get(type).push(handler);
    }
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
    off(type, handler) {
        const handlers = this.eventHandlers.get(type);
        if (!handlers)
            return;
        const index = handlers.indexOf(handler);
        if (index > -1) {
            handlers.splice(index, 1);
        }
    }
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
    configureSampling(options) {
        if (options.enabled !== undefined) {
            this.sampling.enabled = options.enabled;
        }
        if (options.rate !== undefined) {
            this.sampling.rate = options.rate;
            // 如果设置了全局rate但没有设置特定级别的rate，清空rateByLevel以使用全局rate
            if (!options.rateByLevel) {
                this.sampling.rateByLevel = {
                    debug: options.rate,
                    info: options.rate,
                    warn: options.rate,
                    error: options.rate,
                    silent: options.rate,
                };
            }
        }
        if (options.rateByLevel) {
            this.sampling.rateByLevel = {
                debug: options.rateByLevel.debug ?? this.sampling.rateByLevel.debug,
                info: options.rateByLevel.info ?? this.sampling.rateByLevel.info,
                warn: options.rateByLevel.warn ?? this.sampling.rateByLevel.warn,
                error: options.rateByLevel.error ?? this.sampling.rateByLevel.error,
                silent: options.rateByLevel.silent ?? this.sampling.rateByLevel.silent,
            };
        }
    }
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
    configureRateLimit(options) {
        if (options.enabled !== undefined) {
            this.rateLimit.enabled = options.enabled;
        }
        if (options.windowSize !== undefined) {
            this.rateLimit.windowSize = options.windowSize;
        }
        if (options.maxLogsPerWindow !== undefined) {
            this.rateLimit.maxLogsPerWindow = options.maxLogsPerWindow;
        }
        if (options.warnOnLimitExceeded !== undefined) {
            this.rateLimit.warnOnLimitExceeded = options.warnOnLimitExceeded;
        }
    }
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
    getEnvironmentInfo() {
        return {
            environment: this.isNodeEnv ? 'node' : 'browser',
            supportsFileWrite: this.isNodeEnv,
            supportsLocalStorage: this.isBrowserEnv && typeof localStorage !== 'undefined',
        };
    }
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
    configureFilter(options) {
        if (options.enabled !== undefined) {
            this.filter.enabled = options.enabled;
        }
        if (options.filters !== undefined) {
            this.filter.filters = options.filters;
        }
        if (options.mode !== undefined) {
            this.filter.mode = options.mode;
        }
    }
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
    configureFormat(options) {
        if (options.enabled !== undefined) {
            this.format.enabled = options.enabled;
        }
        if (options.timestampFormat !== undefined) {
            this.format.timestampFormat = options.timestampFormat;
        }
        if (options.formatter !== undefined) {
            this.format.formatter = options.formatter;
        }
        if (options.includeStack !== undefined) {
            this.format.includeStack = options.includeStack;
        }
        if (options.includeName !== undefined) {
            this.format.includeName = options.includeName;
        }
        if (options.json !== undefined) {
            this.format.json = options.json;
        }
        if (options.jsonIndent !== undefined) {
            this.format.jsonIndent = options.jsonIndent;
        }
    }
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
    configureErrorHandling(options) {
        if (options.silent !== undefined) {
            this.errorHandling.silent = options.silent;
        }
        if (options.onError !== undefined) {
            this.errorHandling.onError = options.onError;
        }
        if (options.retryCount !== undefined) {
            this.errorHandling.retryCount = options.retryCount;
        }
        if (options.retryDelay !== undefined) {
            this.errorHandling.retryDelay = options.retryDelay;
        }
        if (options.fallbackToConsole !== undefined) {
            this.errorHandling.fallbackToConsole = options.fallbackToConsole;
        }
    }
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
    getMetrics() {
        return {
            ...this.metrics,
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
        };
    }
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
    resetMetrics() {
        this.metrics = {
            totalLogs: 0,
            sampledLogs: 0,
            droppedLogs: 0,
            filteredLogs: 0,
            avgProcessingTime: 0,
            fileWrites: 0,
            fileWriteErrors: 0,
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
        };
        this.processingTimes = [];
    }
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
    updateConfig(options) {
        if (options.level) {
            this.level = options.level;
            this.emitEvent('levelChange', `Log level changed to ${options.level}`);
        }
        if (options.console !== undefined) {
            this.consoleEnabled = options.console.enabled ?? true;
            this.consoleColors = options.console.colors ?? true;
            this.consoleTimestamp = options.console.timestamp ?? true;
        }
        if (options.file !== undefined) {
            if (options.file.enabled && !this.fileManager) {
                this.fileManager = new file_manager_1.FileManager({
                    path: options.file.path ?? './logs',
                    maxSize: options.file.maxSize ?? '10m',
                    maxFiles: options.file.maxFiles ?? 30,
                    filename: options.file.filename ?? 'app',
                });
            }
        }
        if (options.sampling) {
            this.sampling = {
                enabled: options.sampling.enabled ?? false,
                rate: options.sampling.rate ?? 1,
                rateByLevel: {
                    debug: options.sampling.rateByLevel?.debug ?? 1,
                    info: options.sampling.rateByLevel?.info ?? 1,
                    warn: options.sampling.rateByLevel?.warn ?? 1,
                    error: options.sampling.rateByLevel?.error ?? 1,
                    silent: options.sampling.rateByLevel?.silent ?? 1,
                }
            };
        }
        if (options.rateLimit) {
            this.rateLimit = {
                enabled: options.rateLimit.enabled ?? false,
                windowSize: options.rateLimit.windowSize ?? 1000,
                maxLogsPerWindow: options.rateLimit.maxLogsPerWindow ?? 1000,
                warnOnLimitExceeded: options.rateLimit.warnOnLimitExceeded ?? true
            };
        }
        if (options.filter) {
            this.filter = {
                enabled: options.filter.enabled ?? false,
                filters: options.filter.filters ?? [],
                mode: options.filter.mode ?? 'all'
            };
        }
    }
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
    async queryStoredLogs(options) {
        if (!this.fileManager) {
            console.warn('FileManager is not initialized');
            return [];
        }
        try {
            const logs = await this.fileManager.queryLogs(options);
            return logs;
        }
        catch (error) {
            console.error('Failed to query stored logs:', error);
            return [];
        }
    }
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
    async clearStoredLogs() {
        if (!this.fileManager) {
            return;
        }
        try {
            await this.fileManager.clearLogs();
        }
        catch (error) {
            console.error('Failed to clear stored logs:', error);
        }
    }
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
    async close() {
        // 清除刷新定时器
        if (this.fileManager && 'closeFlushTimer' in this.fileManager) {
            const fm = this.fileManager;
            if (fm.closeFlushTimer) {
                clearTimeout(fm.closeFlushTimer);
            }
        }
        // 关闭文件管理器
        if (this.fileManager && 'close' in this.fileManager) {
            const fm = this.fileManager;
            if (typeof fm.close === 'function') {
                try {
                    const result = fm.close();
                    if (result instanceof Promise) {
                        await result;
                    }
                }
                catch (error) {
                    console.error('Error closing FileManager:', error);
                }
            }
        }
    }
}
exports.Logger = Logger;
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
exports.logger = new Logger({
    name: 'app',
    file: {
        enabled: true,
        path: './logs',
        maxSize: '10m',
        maxFiles: 30,
    },
    console: {
        enabled: true,
        colors: true,
        timestamp: true,
    },
});
//# sourceMappingURL=logger.js.map