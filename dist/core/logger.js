"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const logger_base_1 = require("./logger-base");
const file_manager_1 = require("../file/file-manager");
const environment_1 = require("../utils/environment");
const caller_info_1 = require("../utils/caller-info");
const formatter_1 = require("../utils/formatter");
const dayjs_1 = __importDefault(require("dayjs"));
class Logger extends logger_base_1.LoggerBase {
    constructor(options = {}) {
        super();
        this.isNodeEnv = environment_1.isNodeEnvironment;
        this.isBrowserEnv = environment_1.isBrowserEnvironment;
        this.callerInfoHelper = new caller_info_1.CallerInfoHelper();
        this.eventHandlers = new Map();
        this.level = options.level ?? 'info';
        this.name = options.name;
        if (this.isNodeEnv && options.file?.enabled !== false) {
            this.fileManager = new file_manager_1.FileManager({
                ...options.file,
                retryCount: options.errorHandling?.retryCount,
                retryDelay: options.errorHandling?.retryDelay,
            }, options.async);
        }
        else if (this.isBrowserEnv && options.file?.enabled) {
            this.fileManager = new file_manager_1.FileManager(options.file, options.async);
        }
        this.consoleEnabled = options.console?.enabled ?? true;
        this.formatter = new formatter_1.LogFormatter({
            consoleColors: options.console?.colors ?? this.isNodeEnv,
            consoleTimestamp: options.console?.timestamp ?? true,
            format: {
                enabled: options.format?.enabled ?? false,
                timestampFormat: options.format?.timestampFormat ?? 'YYYY-MM-DD HH:mm:ss.SSS',
                formatter: options.format?.formatter,
                includeStack: options.format?.includeStack ?? true,
                includeName: options.format?.includeName ?? true,
                json: options.format?.json ?? false,
                jsonIndent: options.format?.jsonIndent ?? 0,
            },
        });
        if (options.sampling)
            this.configureSampling(options.sampling);
        if (options.rateLimit)
            this.configureRateLimit(options.rateLimit);
        if (options.filter)
            this.configureFilter(options.filter);
        if (options.errorHandling)
            this.configureErrorHandling(options.errorHandling);
    }
    emitLevelChange(level) {
        this.emitEvent('levelChange', `Log level changed to ${level}`);
    }
    // ─── 初始化 ──────────────────────────────────────────────
    init() { this.fileManager?.init(); }
    // ─── 核心日志方法 ─────────────────────────────────────────
    debug(...args) { this.log('debug', ...args); }
    info(...args) { this.log('info', ...args); }
    warn(...args) { this.log('warn', ...args); }
    error(...args) { this.log('error', ...args); }
    // ─── 等级控制 ─────────────────────────────────────────────
    setLevel(level) {
        const old = this.level;
        this.level = level;
        this.emitEvent('levelChange', `日志等级已从 ${old} 更改为 ${level}`, undefined, { oldLevel: old, newLevel: level });
    }
    getLevel() { return this.level; }
    // ─── 事件 ────────────────────────────────────────────────
    on(type, handler) {
        if (!this.eventHandlers.has(type))
            this.eventHandlers.set(type, []);
        this.eventHandlers.get(type).push(handler);
    }
    off(type, handler) {
        const handlers = this.eventHandlers.get(type);
        if (!handlers)
            return;
        const i = handlers.indexOf(handler);
        if (i > -1)
            handlers.splice(i, 1);
    }
    // ─── 子 Logger ───────────────────────────────────────────
    child(name) {
        const { consoleColors, consoleTimestamp, format } = this.formatter.settings;
        const opts = {
            level: this.level,
            name: this.name ? `${this.name}:${name}` : name,
            console: { enabled: this.consoleEnabled, colors: consoleColors, timestamp: consoleTimestamp },
            sampling: { ...this.sampling },
            rateLimit: { ...this.rateLimit },
            filter: { enabled: this.filter.enabled, filters: [...this.filter.filters], mode: this.filter.mode },
            format: { ...format },
            errorHandling: { ...this.errorHandling },
        };
        if (this.fileManager) {
            const fm = this.fileManager;
            opts.file = { enabled: true, path: fm.options.path, maxSize: fm.options.maxSize, maxFiles: fm.options.maxFiles, filename: fm.options.filename };
        }
        return new Logger(opts);
    }
    // ─── 存储（浏览器 IndexedDB） ────────────────────────────
    async queryStoredLogs(options) {
        if (!this.fileManager)
            return [];
        try {
            return await this.fileManager.queryLogs(options);
        }
        catch {
            return [];
        }
    }
    async clearStoredLogs() {
        try {
            await this.fileManager?.clearLogs();
        }
        catch { /* ignore */ }
    }
    // ─── 生命周期 ────────────────────────────────────────────
    async close() {
        const fm = this.fileManager;
        if (typeof fm?.close === 'function') {
            try {
                await fm.close();
            }
            catch (e) {
                console.error('Error closing FileManager:', e);
            }
        }
    }
    // ─── 内部实现 ────────────────────────────────────────────
    shouldLog(level) {
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }
    shouldSample(level) {
        if (!this.sampling.enabled)
            return true;
        return Math.random() < (this.sampling.rateByLevel[level] ?? this.sampling.rate);
    }
    checkRateLimit() {
        if (!this.rateLimit.enabled)
            return true;
        const now = Date.now();
        if (now - this.rlWindowStart >= this.rateLimit.windowSize) {
            this.rlWindowStart = now;
            this.rlWindowCount = 0;
        }
        if (this.rlWindowCount >= this.rateLimit.maxLogsPerWindow) {
            if (this.rateLimit.warnOnLimitExceeded)
                this.emitEvent('rateLimitExceeded', `日志限流已触发: ${this.rlWindowCount}/${this.rateLimit.maxLogsPerWindow} 日志在 ${this.rateLimit.windowSize}ms 内`);
            return false;
        }
        this.rlWindowCount++;
        return true;
    }
    shouldPassFilter(entry) {
        if (!this.filter.enabled || !this.filter.filters.length)
            return true;
        const results = this.filter.filters.map(f => { try {
            return f(entry);
        }
        catch {
            return true;
        } });
        return this.filter.mode === 'all' ? results.every(Boolean) : results.some(Boolean);
    }
    emitEvent(type, message, error, data) {
        const handlers = this.eventHandlers.get(type);
        if (!handlers?.length)
            return;
        const event = { type, message, error, data, timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS') };
        for (const h of handlers) {
            try {
                h(event);
            }
            catch (e) {
                console.error('Error in logger event handler:', e);
            }
        }
    }
    createLogEntry(level, message, data) {
        const { file, line } = this.callerInfoHelper.getCallerInfo();
        const entry = {
            level,
            message: typeof message === 'string' ? message : this.formatter.safeStringify(message),
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
            data,
        };
        if (this.name)
            entry.name = this.name;
        if (file)
            entry.file = file;
        if (line)
            entry.line = line;
        return entry;
    }
    writeToConsole(entry) {
        if (!this.consoleEnabled)
            return;
        const msg = this.formatter.formatConsoleMessage(entry);
        (entry.level === 'error' ? console.error : console.log)(msg);
    }
    writeToFile(entry) {
        if (!this.fileManager)
            return;
        const msg = this.formatter.formatMessage(entry);
        try {
            const p = this.fileManager.write(msg);
            if (p instanceof Promise)
                p.catch(e => this.handleWriteError(e, msg, entry));
            this.metrics.fileWrites++;
        }
        catch (e) {
            this.handleWriteError(e, msg, entry);
        }
    }
    handleWriteError(error, message, entry) {
        this.metrics.fileWriteErrors++;
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            this.errorHandling.onError?.(err, 'file_write');
        }
        catch (e) {
            console.error('Error in error handler:', e);
        }
        this.emitEvent('fileWriteError', `文件写入失败: ${message}`, err);
        if (this.errorHandling.fallbackToConsole && entry)
            console.error('[Logger Fallback]', this.formatter.formatConsoleMessage(entry));
        if (!this.errorHandling.silent)
            throw err;
    }
    log(level, ...args) {
        if (!this.shouldLog(level))
            return;
        let message, data;
        if (args.length === 0) {
            message = '';
            data = undefined;
        }
        else if (typeof args[0] === 'string') {
            message = args[0];
            data = args.length === 2 ? args[1] : args.length > 2 ? args.slice(1) : undefined;
        }
        else if (args[0] instanceof Error) {
            message = args[0].message || String(args[0]);
            data = args.length > 1 ? { error: args[0], additionalData: args.slice(1) } : undefined;
        }
        else {
            message = '';
            data = args.length === 1 ? args[0] : args;
        }
        const start = performance.now();
        this.metrics.totalLogs++;
        if (!this.shouldSample(level)) {
            this.metrics.sampledLogs++;
            this.metrics.droppedLogs++;
            return;
        }
        if (!this.checkRateLimit()) {
            this.metrics.droppedLogs++;
            return;
        }
        const entry = this.createLogEntry(level, message, data);
        if (this.filter.enabled && !this.shouldPassFilter(entry)) {
            this.metrics.filteredLogs++;
            return;
        }
        this.writeToConsole(entry);
        this.writeToFile(entry);
        this.metricsN++;
        this.metrics.avgProcessingTime += (performance.now() - start - this.metrics.avgProcessingTime) / this.metricsN;
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map