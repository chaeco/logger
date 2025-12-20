import { FileOptions } from './types';
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
    constructor(options?: FileOptions);
    private initializeIndexedDB;
    private ensureLogDirectory;
    private initializeCurrentFile;
    private getIndexedFilePath;
    private parseMaxSize;
    private shouldRotateFile;
    private rotateFile;
    private cleanupOldFiles;
    private checkDateRotation;
    write(message: string): Promise<void>;
    /**
     * 从 IndexedDB 查询存储的日志（仅浏览器环境）
     */
    queryLogs(options?: {
        limit?: number;
        offset?: number;
        date?: string;
    }): Promise<any[]>;
    /**
     * 清除 IndexedDB 中的所有日志（仅浏览器环境）
     */
    clearLogs(): Promise<void>;
    /**
     * 关闭存储连接
     */
    close(): void;
}
//# sourceMappingURL=file-manager.d.ts.map