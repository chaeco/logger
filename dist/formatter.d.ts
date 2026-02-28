import { LogEntry, FormatOptions } from './types';
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
     * 格式化为文件输出字符串
     */
    formatMessage(entry: LogEntry): string;
    /**
     * 格式化为带 ANSI 颜色的控制台字符串
     */
    formatConsoleMessage(entry: LogEntry): string;
    /**
     * 安全的 JSON 序列化，处理循环引用
     */
    safeStringify(obj: any, indent?: number): string;
}
//# sourceMappingURL=formatter.d.ts.map