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
    private _initError;
    /** 初始化错误（只读），如果初始化失败则值不为 undefined */
    get initError(): Error | undefined;
    constructor(options: Required<FileOptions>);
    init(): void;
    /** 写入单条消息（内部使用 appendFileSync，通过重试逻辑提供可靠性） */
    write(message: string): Promise<void>;
    /** 批量写入消息（由 AsyncQueue 刷新时调用） */
    writeBatch(messages: string[]): Promise<void>;
    private ensureLogDirectory;
    private initializeCurrentFile;
    private getIndexedFilePath;
    private shouldRotateFile;
    private rotateFile;
    private cleanupOldFiles;
    private compressOldLogs;
    private checkDateRotation;
    private appendToFileWithRetry;
}
//# sourceMappingURL=node-writer.d.ts.map