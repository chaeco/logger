import { LogLevel, LoggerOptions, LoggerEventType, LoggerEventHandler, FormatOptions, ErrorHandlingOptions } from './types';
/**
 * 日志器主类
 * @remarks
 * 扁平结构，无继承。支持多级别日志、彩色控制台输出、文件写入、事件钩子与子 Logger。
 * 仅支持 Node.js 运行时。
 */
export declare class Logger {
    private level;
    private readonly name;
    private fileManager;
    private consoleEnabled;
    private readonly formatter;
    private readonly callerInfoHelper;
    private readonly errorHandling;
    private readonly eventHandlers;
    private readonly levelPriority;
    constructor(options?: LoggerOptions);
    init(): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
    configureFormat(options: Partial<FormatOptions>): void;
    configureErrorHandling(options: ErrorHandlingOptions): void;
    updateConfig(options: LoggerOptions): void;
    on(type: LoggerEventType, handler: LoggerEventHandler): void;
    off(type: LoggerEventType, handler: LoggerEventHandler): void;
    child(name: string): Logger;
    close(): Promise<void>;
    private shouldLog;
    private emitEvent;
    private createLogEntry;
    private writeToConsole;
    private writeToFile;
    private handleWriteError;
    private log;
}
//# sourceMappingURL=logger.d.ts.map