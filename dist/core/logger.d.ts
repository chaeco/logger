import { LogLevel, LoggerOptions, LoggerEventType, LoggerEventHandler } from './types';
import { LoggerBase } from './logger-base';
import { FileManager } from '../file/file-manager';
import { LogFormatter } from '../utils/formatter';
export declare class Logger extends LoggerBase {
    protected level: LogLevel;
    private name?;
    protected fileManager: FileManager | undefined;
    protected consoleEnabled: boolean;
    protected readonly isNodeEnv: boolean;
    private readonly isBrowserEnv;
    private readonly callerInfoHelper;
    protected formatter: LogFormatter;
    private eventHandlers;
    constructor(options?: LoggerOptions);
    protected emitLevelChange(level: LogLevel): void;
    init(): void;
    debug(...args: any[]): void;
    info(...args: any[]): void;
    warn(...args: any[]): void;
    error(...args: any[]): void;
    setLevel(level: LogLevel): void;
    getLevel(): LogLevel;
    on(type: LoggerEventType, handler: LoggerEventHandler): void;
    off(type: LoggerEventType, handler: LoggerEventHandler): void;
    child(name: string): Logger;
    queryStoredLogs(options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<Record<string, unknown>[]>;
    clearStoredLogs(): Promise<void>;
    close(): Promise<void>;
    private shouldLog;
    private shouldSample;
    private checkRateLimit;
    private shouldPassFilter;
    private emitEvent;
    private createLogEntry;
    private writeToConsole;
    private writeToFile;
    private handleWriteError;
    private log;
}
//# sourceMappingURL=logger.d.ts.map