import { LogEntry, FormatOptions } from '../core/types';
/**
 * 格式化器运行时配置
 */
export interface FormatterSettings {
    consoleTimestamp: boolean;
    consoleColors: boolean;
    format: {
        enabled: boolean;
        timestampFormat: string;
        formatter?: (entry: LogEntry) => string;
        includeStack: boolean;
        includeName: boolean;
        json: boolean;
        jsonIndent: number;
    };
}
/**
 * 日志格式化器
 * @internal
 * 负责将 LogEntry 转换为可输出的字符串，支持普通文本、彩色控制台和 JSON 格式。
 */
export declare class LogFormatter {
    settings: FormatterSettings;
    constructor(settings: FormatterSettings);
    /**
     * 更新格式化选项（支持部分更新）
     */
    updateFormat(options: Partial<FormatOptions>): void;
    /**
     * 格式化为文件输出字符串。
     * 注意：文件日志始终包含时间戳，与控制台的 consoleTimestamp 开关无关。
     */
    formatMessage(entry: LogEntry): string;
    /**
     * 格式化为带 ANSI 颜色的控制台字符串。
     * 无色模式下使用纯文本，且遵守 consoleTimestamp 开关（与文件格式独立）。
     * 自定义 formatter 函数的优先级高于颜色开关。
     */
    formatConsoleMessage(entry: LogEntry): string;
    /**
     * 构建纯文本日志行，供文件输出和无色控制台复用。
     * @param includeTimestamp 是否包含时间戳（文件格式始终传 true；控制台按 consoleTimestamp 传入）
     */
    private buildPlainText;
    /**
     * 安全的 JSON 序列化，处理循环引用
     */
    private safeStringify;
}
//# sourceMappingURL=formatter.d.ts.map