import { FileOptions } from '../core/types';
/**
 * Node.js 文件写入器 - 管理日志文件的创建、轮转、压缩与清理。
 * @internal
 */
export declare class NodeWriter {
    private readonly options;
    private currentFilePath;
    private currentFileSize;
    private fileIndex;
    initError?: Error;
    constructor(options: Required<FileOptions>);
    init(): void;
    /** 同步写入单条消息 */
    write(message: string): Promise<void>;
    /** 批量写入消息（异步队列刷新路径） */
    writeBatch(messages: string[]): Promise<void>;
    private ensureLogDirectory;
    private initializeCurrentFile;
    private getIndexedFilePath;
    private parseMaxSize;
    private shouldRotateFile;
    private rotateFile;
    private cleanupOldFiles;
    private compressOldLogs;
    private checkDateRotation;
    private appendToFileWithRetry;
}
//# sourceMappingURL=node-writer.d.ts.map