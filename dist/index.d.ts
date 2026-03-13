/**
 * @chaeco/logger - 功能完整的日志模块
 *
 * @remarks
 * 仅支持 Node.js 运行时，提供多级别日志、彩色控制台输出、文件写入和错误事件处理等功能。
 *
 * @packageDocumentation
 */
import { Logger } from './core/logger';
export { Logger };
/**
 * 默认 Logger 实例（name: 'app'，level: 'info'，写入 ./logs）
 */
export declare const logger: Logger;
export type { LogLevel, LoggerOptions, FileOptions, ConsoleOptions, LogEntry, LoggerEventType, LoggerEventHandler, LoggerEvent, FormatOptions, AsyncWriteOptions, ErrorHandlingOptions, } from './core/types';
//# sourceMappingURL=index.d.ts.map