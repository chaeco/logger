"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const file_manager_1 = require("../file/file-manager");
const caller_info_1 = require("../utils/caller-info");
const formatter_1 = require("../utils/formatter");
const dayjs_1 = __importDefault(require("dayjs"));
/**
 * 日志器主类
 * @remarks
 * 扁平结构，无继承。支持多级别日志、彩色控制台输出、文件写入、事件钩子与子 Logger。
 * 仅支持 Node.js 运行时。
 */
class Logger {
    constructor(options = {}) {
        this.callerInfoHelper = new caller_info_1.CallerInfoHelper();
        this.errorHandling = {
            silent: true, onError: undefined, fallbackToConsole: true,
        };
        this.eventHandlers = new Map();
        this.levelPriority = {
            debug: 0, info: 1, warn: 2, error: 3, silent: 999,
        };
        this.level = options.level ?? 'info';
        this.name = options.name;
        if (options.file?.enabled !== false) {
            this.fileManager = new file_manager_1.FileManager(options.file, options.async);
        }
        this.consoleEnabled = options.console?.enabled ?? true;
        this.formatter = new formatter_1.LogFormatter({
            consoleColors: options.console?.colors ?? true,
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
        if (options.errorHandling)
            this.configureErrorHandling(options.errorHandling);
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
    // ─── 配置 ─────────────────────────────────────────────────
    configureFormat(options) {
        this.formatter.updateFormat(options);
    }
    configureErrorHandling(options) {
        if (options.silent !== undefined)
            this.errorHandling.silent = options.silent;
        if (options.onError !== undefined)
            this.errorHandling.onError = options.onError;
        if (options.fallbackToConsole !== undefined)
            this.errorHandling.fallbackToConsole = options.fallbackToConsole;
    }
    updateConfig(options) {
        if (options.level !== undefined)
            this.setLevel(options.level);
        if (options.console !== undefined) {
            this.consoleEnabled = options.console.enabled ?? this.consoleEnabled;
            this.formatter.settings.consoleColors = options.console.colors ?? this.formatter.settings.consoleColors;
            this.formatter.settings.consoleTimestamp = options.console.timestamp ?? this.formatter.settings.consoleTimestamp;
        }
        if (options.file !== undefined && options.file.enabled !== false && !this.fileManager) {
            this.fileManager = new file_manager_1.FileManager(options.file, options.async);
        }
        if (options.format)
            this.configureFormat(options.format);
        if (options.errorHandling)
            this.configureErrorHandling(options.errorHandling);
    }
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
            format: { ...format },
            errorHandling: { ...this.errorHandling },
        };
        if (this.fileManager) {
            const fmOpts = this.fileManager.getOptions();
            opts.file = {
                enabled: true,
                path: fmOpts.path,
                maxSize: fmOpts.maxSize,
                maxFiles: fmOpts.maxFiles,
                filename: fmOpts.filename,
                maxAge: fmOpts.maxAge,
                compress: fmOpts.compress,
                retryCount: fmOpts.retryCount,
                retryDelay: fmOpts.retryDelay,
            };
            opts.async = this.fileManager.getAsyncOptions();
        }
        else {
            opts.file = { enabled: false };
        }
        return new Logger(opts);
    }
    // ─── 生命周期 ────────────────────────────────────────────
    async close() {
        if (this.fileManager) {
            try {
                await this.fileManager.close();
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
            message,
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
        const consoleFn = entry.level === 'error' ? console.error : console.log;
        consoleFn(msg);
    }
    writeToFile(entry) {
        if (!this.fileManager)
            return;
        const msg = this.formatter.formatMessage(entry);
        this.fileManager.write(msg).catch(e => this.handleWriteError(e, msg, entry));
    }
    handleWriteError(error, message, entry) {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            this.errorHandling.onError?.(err, 'file_write');
        }
        catch (e) {
            console.error('Error in error handler:', e);
        }
        const preview = message.length > 120 ? message.slice(0, 120) + '…' : message;
        this.emitEvent('fileWriteError', `文件写入失败: ${preview}`, err);
        if (this.errorHandling.fallbackToConsole && !this.errorHandling.silent && entry)
            console.error('[Logger Fallback]', this.formatter.formatConsoleMessage(entry));
    }
    log(level, ...args) {
        if (!this.shouldLog(level))
            return;
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
            message = args[0].message || String(args[0]);
            data = args.length > 1 ? { error: args[0], additionalData: args.slice(1) } : args[0];
        }
        else {
            message = '';
            data = args.length === 1 ? args[0] : args;
        }
        const entry = this.createLogEntry(level, message, data);
        this.writeToConsole(entry);
        this.writeToFile(entry);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map