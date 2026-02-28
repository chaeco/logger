"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const environment_1 = require("../utils/environment");
const node_writer_1 = require("./node-writer");
const async_queue_1 = require("./async-queue");
// 条件加载 IndexedDB 模块（仅浏览器环境）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let IndexedDBStorage;
if (environment_1.isBrowserEnvironment) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const m = require('@chaeco/indexed-db-storage');
        IndexedDBStorage = m.IndexedDBStorage;
    }
    catch (e) {
        console.warn('@chaeco/logger: Failed to load IndexedDB storage:', e);
    }
}
/**
 * 文件管理器 - 按环境路由日志写入：Node.js 使用文件系统，浏览器使用 IndexedDB。
 * @internal
 */
class FileManager {
    constructor(options = {}, asyncOptions) {
        this.isInitialized = false;
        this.options = {
            enabled: options.enabled ?? true,
            path: options.path ?? './logs',
            maxSize: options.maxSize ?? '10m',
            maxFiles: options.maxFiles ?? 30,
            filename: options.filename ?? 'app',
            maxAge: options.maxAge ?? 30,
            compress: options.compress ?? false,
            writeMode: options.writeMode ?? 'sync',
            fileMode: options.fileMode ?? 0o644,
            dirMode: options.dirMode ?? 0o755,
            retryCount: options.retryCount ?? 3,
            retryDelay: options.retryDelay ?? 100,
        };
        if (environment_1.isNodeEnvironment) {
            this.nodeWriter = new node_writer_1.NodeWriter(this.options);
            if (asyncOptions?.enabled) {
                const ao = {
                    enabled: asyncOptions.enabled,
                    queueSize: asyncOptions.queueSize ?? 1000,
                    batchSize: asyncOptions.batchSize ?? 100,
                    flushInterval: asyncOptions.flushInterval ?? 1000,
                    overflowStrategy: asyncOptions.overflowStrategy ?? 'drop',
                };
                this.asyncQueue = new async_queue_1.AsyncQueue(ao, msgs => this.nodeWriter.writeBatch(msgs));
                this.asyncQueue.start();
            }
        }
    }
    /** 提前初始化（可选，首次写入时也会自动初始化） */
    init() {
        if (this.isInitialized)
            return;
        try {
            if (environment_1.isNodeEnvironment && this.nodeWriter) {
                this.nodeWriter.init();
                if (this.nodeWriter.initError)
                    this.initError = this.nodeWriter.initError;
                else
                    this.isInitialized = true;
            }
            else if (environment_1.isBrowserEnvironment) {
                this.initBrowser().catch(e => {
                    this.initError = e instanceof Error ? e : new Error(String(e));
                    console.warn('@chaeco/logger: Failed to initialize IndexedDB storage:', e);
                });
            }
            else {
                console.warn('@chaeco/logger: FileManager 在当前环境中不可用。');
            }
        }
        catch (e) {
            this.initError = e instanceof Error ? e : new Error(String(e));
            console.warn('@chaeco/logger: Failed to initialize FileManager:', e);
        }
    }
    async initBrowser() {
        this.indexedDBStorage = new IndexedDBStorage({
            dbName: '@chaeco/logger-files',
            storeName: this.options.filename,
            maxRecords: this.options.maxFiles,
            retentionTime: this.options.maxAge * 24 * 60 * 60 * 1000,
            cleanupInterval: 60 * 60 * 1000,
            timestampIndexName: 'timestamp',
        });
        await this.indexedDBStorage.init();
        this.isInitialized = true;
    }
    async write(message) {
        if (!this.options.enabled)
            return;
        if (!this.isInitialized && !this.initError)
            this.init();
        if (this.initError)
            return;
        if (environment_1.isBrowserEnvironment && this.indexedDBStorage && this.isInitialized) {
            try {
                await this.indexedDBStorage.save({
                    timestamp: Date.now(),
                    date: (0, dayjs_1.default)().format('YYYY-MM-DD'),
                    content: message,
                    size: new Blob([message]).size,
                });
            }
            catch (e) {
                console.error('Failed to write log to IndexedDB:', e);
            }
            return;
        }
        if (this.asyncQueue) {
            await this.asyncQueue.enqueue(message);
            return;
        }
        await this.nodeWriter.write(message);
    }
    /** 查询 IndexedDB 中的日志（仅浏览器环境） */
    async queryLogs(options) {
        if (!environment_1.isBrowserEnvironment || !this.indexedDBStorage || !this.isInitialized) {
            console.warn('queryLogs is only available in browser environment with IndexedDB');
            return [];
        }
        try {
            const result = await this.indexedDBStorage.query({ limit: options?.limit ?? 100, offset: options?.offset ?? 0 });
            let logs = [];
            if (Array.isArray(result)) {
                logs = result;
            }
            else if (result && typeof result === 'object' && 'data' in result) {
                const r = result;
                logs = Array.isArray(r.data) ? r.data : [];
            }
            return options?.date ? logs.filter(l => l.date === options.date) : logs;
        }
        catch (e) {
            console.error('Failed to query logs from IndexedDB:', e);
            return [];
        }
    }
    /** 清除 IndexedDB 中所有日志（仅浏览器环境） */
    async clearLogs() {
        if (!environment_1.isBrowserEnvironment || !this.indexedDBStorage || !this.isInitialized)
            return;
        try {
            await this.indexedDBStorage.clear();
        }
        catch (e) {
            console.error('Failed to clear logs from IndexedDB:', e);
        }
    }
    /** 关闭存储，刷新剩余队列 */
    async close() {
        await this.asyncQueue?.stop();
        if (this.indexedDBStorage)
            this.indexedDBStorage.close();
    }
    /** 获取异步队列状态 */
    getQueueStatus() {
        return { size: this.asyncQueue?.size ?? 0, isWriting: this.asyncQueue?.writing ?? false };
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=file-manager.js.map