/**
 * IndexedDB 存储模块
 * @internal
 * @remarks
 * 用于在浏览器环境中持久化存储日志到 IndexedDB
 */
import { LogEntry } from './types';
interface StoredLog extends LogEntry {
    id?: number;
    storedAt: number;
}
/**
 * IndexedDB 存储管理器
 * @internal
 */
export declare class IndexedDBStorage {
    private dbName;
    private storeName;
    private maxLogs;
    private retentionTime;
    private cleanupInterval;
    private db;
    private cleanupTimer?;
    constructor(options?: {
        dbName?: string;
        storeName?: string;
        maxLogs?: number;
        retentionTime?: number;
        cleanupInterval?: number;
    });
    /**
     * 初始化 IndexedDB
     * @internal
     */
    init(): Promise<void>;
    /**
     * 保存日志到 IndexedDB
     * @internal
     */
    save(entry: LogEntry): Promise<void>;
    /**
     * 查询日志
     * @internal
     */
    query(options?: {
        limit?: number;
        offset?: number;
        level?: string;
    }): Promise<StoredLog[]>;
    /**
     * 清空所有日志
     * @internal
     */
    clear(): Promise<void>;
    /**
     * 删除过期日志
     * @internal
     */
    private deleteExpiredLogs;
    /**
     * 强制执行最大日志数限制
     * @internal
     */
    private enforceMaxLogs;
    /**
     * 启动定时清理任务
     * @internal
     */
    private startCleanupTimer;
    /**
     * 停止定时清理任务
     * @internal
     */
    stopCleanupTimer(): void;
    /**
     * 关闭数据库连接
     * @internal
     */
    close(): void;
}
export {};
//# sourceMappingURL=indexed-db-storage.d.ts.map