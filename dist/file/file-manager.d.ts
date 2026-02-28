import { FileOptions, AsyncWriteOptions } from '../core/types';
/**
 * 文件管理器 - 按环境路由日志写入：Node.js 使用文件系统，浏览器使用 IndexedDB。
 * @internal
 */
export declare class FileManager {
    private indexedDBStorage?;
    private isInitialized;
    private initError?;
    private nodeWriter?;
    private asyncQueue?;
    private readonly options;
    constructor(options?: FileOptions, asyncOptions?: AsyncWriteOptions);
    /** 提前初始化（可选，首次写入时也会自动初始化） */
    init(): void;
    private initBrowser;
    write(message: string): Promise<void>;
    /** 查询 IndexedDB 中的日志（仅浏览器环境） */
    queryLogs(options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<Record<string, unknown>[]>;
    /** 清除 IndexedDB 中所有日志（仅浏览器环境） */
    clearLogs(): Promise<void>;
    /** 关闭存储，刷新剩余队列 */
    close(): Promise<void>;
    /** 获取异步队列状态 */
    getQueueStatus(): {
        size: number;
        isWriting: boolean;
    };
}
//# sourceMappingURL=file-manager.d.ts.map