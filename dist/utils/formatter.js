"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.LogFormatter = void 0;
const color_utils_1 = require("./color-utils");
const dayjs_1 = __importDefault(require("dayjs"));
/**
 * 日志格式化器
 * @internal
 * 负责将 LogEntry 转换为可输出的字符串，支持普通文本、彩色控制台和 JSON 格式。
 */
class LogFormatter {
    constructor(settings) {
        this.settings = settings;
    }
    /**
     * 更新格式化选项（支持部分更新）
     */
    updateFormat(options) {
        const f = this.settings.format;
        if (options.enabled !== undefined)
            f.enabled = options.enabled;
        if (options.timestampFormat !== undefined)
            f.timestampFormat = options.timestampFormat;
        if (options.formatter !== undefined)
            f.formatter = options.formatter;
        if (options.includeStack !== undefined)
            f.includeStack = options.includeStack;
        if (options.includeName !== undefined)
            f.includeName = options.includeName;
        if (options.json !== undefined)
            f.json = options.json;
        if (options.jsonIndent !== undefined)
            f.jsonIndent = options.jsonIndent;
    }
    // ─── 公开格式化方法 ───────────────────────────────────────
    /**
     * 格式化为文件输出字符串
     */
    formatMessage(entry) {
        const { format, consoleTimestamp } = this.settings;
        // 自定义格式化函数
        if (format.enabled && format.formatter) {
            try {
                return format.formatter(entry);
            }
            catch (error) {
                console.error('Error in custom formatter:', error);
                // 降级到默认格式
            }
        }
        // JSON 格式输出
        if (format.json) {
            const jsonEntry = {
                timestamp: entry.timestamp,
                level: entry.level,
                message: entry.message,
            };
            if (format.includeName && entry.name)
                jsonEntry.name = entry.name;
            if (format.includeStack && entry.file && entry.line) {
                jsonEntry.file = entry.file;
                jsonEntry.line = entry.line;
            }
            if (entry.data !== undefined)
                jsonEntry.data = entry.data;
            return this.safeStringify(jsonEntry, format.jsonIndent);
        }
        // 默认格式
        const parts = [];
        if (consoleTimestamp) {
            const ts = (0, dayjs_1.default)(entry.timestamp).format(format.timestampFormat);
            parts.push(`[${ts}]`);
        }
        if (format.includeName && entry.name)
            parts.push(`[${entry.name}]`);
        parts.push(entry.level.toUpperCase().padEnd(5));
        if (format.includeStack && entry.file && entry.line) {
            parts.push(`(${entry.file}:${entry.line})`);
        }
        parts.push(entry.message);
        if (entry.data !== undefined)
            parts.push(this.safeStringify(entry.data));
        return parts.join(' ');
    }
    /**
     * 格式化为带 ANSI 颜色的控制台字符串
     */
    formatConsoleMessage(entry) {
        const { consoleColors, consoleTimestamp } = this.settings;
        if (!consoleColors) {
            return this.formatMessage(entry);
        }
        const parts = [];
        if (consoleTimestamp) {
            parts.push(color_utils_1.ColorUtils.colorizeTimestamp(`[${entry.timestamp}]`));
        }
        if (entry.name)
            parts.push(color_utils_1.ColorUtils.colorizeName(entry.name));
        parts.push(color_utils_1.ColorUtils.colorizeLevel(entry.level));
        if (entry.file && entry.line) {
            parts.push(color_utils_1.ColorUtils.colorizeFileLocation(`${entry.file}:${entry.line}`));
        }
        parts.push(color_utils_1.ColorUtils.colorizeMessage(entry.level, entry.message));
        if (entry.data !== undefined)
            parts.push(this.safeStringify(entry.data));
        return parts.join(' ');
    }
    /**
     * 安全的 JSON 序列化，处理循环引用
     */
    safeStringify(obj, indent) {
        try {
            const seen = new WeakSet();
            return JSON.stringify(obj, (_key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value))
                        return '[Circular]';
                    seen.add(value);
                }
                return value;
            }, indent);
        }
        catch {
            try {
                return String(obj);
            }
            catch {
                return '[Unable to serialize]';
            }
        }
    }
}
exports.LogFormatter = LogFormatter;
//# sourceMappingURL=formatter.js.map