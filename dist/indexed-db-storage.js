"use strict";
/**
 * IndexedDB 存储模块
 * @internal
 * @remarks
 * 用于在浏览器环境中持久化存储日志到 IndexedDB
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.IndexedDBStorage = void 0;
/**
 * IndexedDB 存储管理器
 * @internal
 */
class IndexedDBStorage {
    constructor(options = {}) {
        this.db = null;
        this.dbName = options.dbName ?? '@chaeco/logger';
        this.storeName = options.storeName ?? 'logs';
        this.maxLogs = options.maxLogs ?? 1000;
        this.retentionTime = options.retentionTime ?? 24 * 60 * 60 * 1000; // 24 小时
        this.cleanupInterval = options.cleanupInterval ?? 60 * 60 * 1000; // 1 小时
    }
    /**
     * 初始化 IndexedDB
     * @internal
     */
    async init() {
        return new Promise((resolve, reject) => {
            if (!('indexedDB' in window)) {
                reject(new Error('IndexedDB not supported'));
                return;
            }
            const request = indexedDB.open(this.dbName, 1);
            request.onerror = () => {
                reject(request.error);
            };
            request.onsuccess = () => {
                this.db = request.result;
                this.startCleanupTimer();
                resolve();
            };
            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains(this.storeName)) {
                    const store = db.createObjectStore(this.storeName, { keyPath: 'id', autoIncrement: true });
                    store.createIndex('storedAt', 'storedAt', { unique: false });
                }
            };
        });
    }
    /**
     * 保存日志到 IndexedDB
     * @internal
     */
    async save(entry) {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const storedLog = {
                ...entry,
                storedAt: Date.now(),
            };
            const request = store.add(storedLog);
            request.onerror = () => {
                reject(request.error);
            };
            request.onsuccess = () => {
                // 检查是否超过最大日志数
                this.enforceMaxLogs().catch(console.error);
                resolve();
            };
        });
    }
    /**
     * 查询日志
     * @internal
     */
    async query(options = {}) {
        if (!this.db)
            return [];
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('storedAt');
            // 按时间倒序查询
            const request = index.getAll();
            request.onerror = () => {
                reject(request.error);
            };
            request.onsuccess = () => {
                let results = request.result.reverse();
                // 按级别过滤
                if (options.level) {
                    results = results.filter((log) => log.level === options.level);
                }
                // 应用偏移和限制
                const offset = options.offset ?? 0;
                const limit = options.limit ?? 100;
                resolve(results.slice(offset, offset + limit));
            };
        });
    }
    /**
     * 清空所有日志
     * @internal
     */
    async clear() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();
            request.onerror = () => {
                reject(request.error);
            };
            request.onsuccess = () => {
                resolve();
            };
        });
    }
    /**
     * 删除过期日志
     * @internal
     */
    async deleteExpiredLogs() {
        if (!this.db)
            return;
        const now = Date.now();
        const threshold = now - this.retentionTime;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const index = store.index('storedAt');
            const range = IDBKeyRange.upperBound(threshold, true);
            const request = index.openCursor(range);
            request.onerror = () => {
                reject(request.error);
            };
            request.onsuccess = () => {
                const cursor = request.result;
                if (cursor) {
                    cursor.delete();
                    cursor.continue();
                }
                else {
                    resolve();
                }
            };
        });
    }
    /**
     * 强制执行最大日志数限制
     * @internal
     */
    async enforceMaxLogs() {
        if (!this.db)
            return;
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const countRequest = store.count();
            countRequest.onerror = () => {
                reject(countRequest.error);
            };
            countRequest.onsuccess = () => {
                const count = countRequest.result;
                if (count > this.maxLogs) {
                    const toDelete = count - Math.floor(this.maxLogs * 0.9);
                    const index = store.index('storedAt');
                    const request = index.openCursor();
                    let deleted = 0;
                    request.onerror = () => {
                        reject(request.error);
                    };
                    request.onsuccess = () => {
                        const cursor = request.result;
                        if (cursor && deleted < toDelete) {
                            cursor.delete();
                            deleted++;
                            cursor.continue();
                        }
                        else {
                            resolve();
                        }
                    };
                }
                else {
                    resolve();
                }
            };
        });
    }
    /**
     * 启动定时清理任务
     * @internal
     */
    startCleanupTimer() {
        if (this.cleanupTimer)
            return;
        this.cleanupTimer = setInterval(async () => {
            try {
                await this.deleteExpiredLogs();
            }
            catch (error) {
                console.error('IndexedDB cleanup error:', error);
            }
        }, this.cleanupInterval);
    }
    /**
     * 停止定时清理任务
     * @internal
     */
    stopCleanupTimer() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
    }
    /**
     * 关闭数据库连接
     * @internal
     */
    close() {
        this.stopCleanupTimer();
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }
}
exports.IndexedDBStorage = IndexedDBStorage;
//# sourceMappingURL=indexed-db-storage.js.map