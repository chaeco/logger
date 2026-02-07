import { FileOptions, AsyncWriteOptions } from './types';
/**
 * 文件管理器类
 * @internal
 * @remarks
 * 负责管理日志文件的创建、写入、轮转和清理。
 * - Node.js 环境：使用文件系统写入
 * - 浏览器环境：使用 IndexedDB 存储（@chaeco/indexed-db-storage）
 *
 * 支持按日期分割和大文件自动分割。
 */
export declare class FileManager {
    private options;
    private currentFilePath;
    private currentFileSize;
    private fileIndex;
    private indexedDBStorage?;
    private isInitialized;
    private asyncOptions?;
    private writeQueue;
    private flushTimer?;
    private isWriting;
    private initError?;
    constructor(options?: FileOptions, asyncOptions?: AsyncWriteOptions);
    /**
     * 初始化文件管理器
     * @remarks
     * 创建日志目录并初始化当前日志文件。
     * 通常不需要手动调用此方法，首次写入日志时会自动初始化。
     * 仅在需要提前确保目录存在时手动调用。
     */
    init(): void;
    private initializeIndexedDB;
    private ensureLogDirectory;
    private initializeCurrentFile;
    private getIndexedFilePath;
    private parseMaxSize;
    private shouldRotateFile;
    private rotateFile;
    private cleanupOldFiles;
    /**
     * 压缩旧的日志文件
     * @private
     */
    private compressOldLogs;
    private checkDateRotation;
    write(message: string): Promise<void>;
    /**
     * 将消息加入异步写入队列
     * @private
     */
    private enqueueMessage;
    /**
     * 启动定时刷新器
     * @private
     */
    private startFlushTimer;
    /**
     * 刷新写入队列
     * @private
     */
    private flushQueue;
    /**
     * 带重试机制的文件写入
     * @private
     */
    private writeToFileWithRetry;
    /**
     * 带重试的追加文件内容
     * @private
     */
    private appendToFileWithRetry;
    /**
     * 从 IndexedDB 查询存储的日志（仅浏览器环境）
     */
    queryLogs(options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<Record<string, unknown>[]>;
    /**
     * 清除 IndexedDB 中的所有日志（仅浏览器环境）
     */
    clearLogs(): Promise<void>;
    /**
     * 关闭存储连接
     */
    close(): Promise<void>;
    /**
     * 获取队列状态
     */
    getQueueStatus(): {
        size: number;
        isWriting: boolean;
    };
}
//# sourceMappingURL=file-manager.d.ts.map