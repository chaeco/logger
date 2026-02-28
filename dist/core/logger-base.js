"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoggerBase = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const file_manager_1 = require("../file/file-manager");
const environment_1 = require("../utils/environment");
/**
 * LoggerBase - 持有配置状态及所有 configure* 方法的抽象基类。
 * Logger 子类提供 formatter、fileManager 等具体实现。
 * @internal
 */
class LoggerBase {
    constructor() {
        this.sampling = {
            enabled: false, rate: 1,
            rateByLevel: { debug: 1, info: 1, warn: 1, error: 1, silent: 1 },
        };
        this.rateLimit = {
            enabled: false, windowSize: 1000, maxLogsPerWindow: 1000, warnOnLimitExceeded: true,
        };
        this.rlWindowStart = 0;
        this.rlWindowCount = 0;
        this.filter = { enabled: false, filters: [], mode: 'all' };
        this.errorHandling = {
            silent: true, onError: undefined, fallbackToConsole: true,
        };
        this.metrics = {
            totalLogs: 0, sampledLogs: 0, droppedLogs: 0, filteredLogs: 0,
            avgProcessingTime: 0, fileWrites: 0, fileWriteErrors: 0,
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
        };
        this.metricsN = 0;
        this.levelPriority = {
            debug: 0, info: 1, warn: 2, error: 3, silent: 999,
        };
    }
    configureSampling(options) {
        if (options.enabled !== undefined)
            this.sampling.enabled = options.enabled;
        if (options.rate !== undefined) {
            this.sampling.rate = options.rate;
            // 无论是否同时传入 rateByLevel，全局 rate 都先整体传播到各级别作为默认值，
            // 避免"同时传 rate + rateByLevel"时未覆盖的级别仍使用旧值的隐患。
            const r = options.rate;
            this.sampling.rateByLevel = { debug: r, info: r, warn: r, error: r, silent: r };
        }
        if (options.rateByLevel) {
            // rateByLevel 作为精细覆盖，叠加在全局 rate 之上
            const cur = this.sampling.rateByLevel;
            const rl = options.rateByLevel;
            this.sampling.rateByLevel = {
                debug: rl.debug ?? cur.debug,
                info: rl.info ?? cur.info,
                warn: rl.warn ?? cur.warn,
                error: rl.error ?? cur.error,
                silent: rl.silent ?? cur.silent,
            };
        }
    }
    configureRateLimit(options) {
        if (options.enabled !== undefined)
            this.rateLimit.enabled = options.enabled;
        if (options.windowSize !== undefined)
            this.rateLimit.windowSize = options.windowSize;
        if (options.maxLogsPerWindow !== undefined)
            this.rateLimit.maxLogsPerWindow = options.maxLogsPerWindow;
        if (options.warnOnLimitExceeded !== undefined)
            this.rateLimit.warnOnLimitExceeded = options.warnOnLimitExceeded;
    }
    configureFilter(options) {
        if (options.enabled !== undefined)
            this.filter.enabled = options.enabled;
        if (options.filters !== undefined)
            this.filter.filters = options.filters;
        if (options.mode !== undefined)
            this.filter.mode = options.mode;
    }
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
        if (options.level !== undefined) {
            const old = this.level;
            this.level = options.level;
            this.emitLevelChange(options.level, old);
        }
        if (options.console !== undefined) {
            // 三处字段均回退到当前值，避免"只传其中一个字段"时其余字段被重置为全局默认值
            this.consoleEnabled = options.console.enabled ?? this.consoleEnabled;
            this.formatter.settings.consoleColors = options.console.colors ?? this.formatter.settings.consoleColors;
            this.formatter.settings.consoleTimestamp = options.console.timestamp ?? this.formatter.settings.consoleTimestamp;
        }
        // 与构造函数保持一致：enabled 缺省视为 true（!== false），而非需要显式传 true
        if (environment_1.isNodeEnvironment && options.file !== undefined && options.file.enabled !== false && !this.fileManager) {
            this.fileManager = new file_manager_1.FileManager(options.file, options.async);
        }
        if (options.sampling)
            this.configureSampling(options.sampling);
        if (options.rateLimit)
            this.configureRateLimit(options.rateLimit);
        if (options.filter)
            this.configureFilter(options.filter);
        if (options.format)
            this.configureFormat(options.format);
        if (options.errorHandling)
            this.configureErrorHandling(options.errorHandling);
    }
    getMetrics() {
        return { ...this.metrics, timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS') };
    }
    resetMetrics() {
        this.metricsN = 0;
        this.metrics = {
            totalLogs: 0, sampledLogs: 0, droppedLogs: 0, filteredLogs: 0,
            avgProcessingTime: 0, fileWrites: 0, fileWriteErrors: 0,
            timestamp: (0, dayjs_1.default)().format('YYYY-MM-DD HH:mm:ss.SSS'),
        };
    }
}
exports.LoggerBase = LoggerBase;
//# sourceMappingURL=logger-base.js.map