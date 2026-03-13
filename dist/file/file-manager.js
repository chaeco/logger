"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const node_writer_1 = require("./node-writer");
const async_queue_1 = require("./async-queue");
/**
 * 文件管理器 - 管理日志文件写入（仅 Node.js）。
 * @internal
 */
class FileManager {
    constructor(options = {}, asyncOptions) {
        this.isInitialized = false;
        this.asyncOptions = asyncOptions;
        this.options = {
            enabled: options.enabled ?? true,
            path: options.path ?? './logs',
            maxSize: options.maxSize ?? 10 * 1024 * 1024,
            maxFiles: options.maxFiles ?? 30,
            filename: options.filename ?? 'app',
            maxAge: options.maxAge ?? 30,
            compress: options.compress ?? false,
            retryCount: options.retryCount ?? 3,
            retryDelay: options.retryDelay ?? 100,
        };
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
    /** 提前初始化（可选，首次写入时也会自动初始化） */
    init() {
        if (this.isInitialized)
            return;
        try {
            this.nodeWriter.init();
            if (this.nodeWriter.initError)
                this.initError = this.nodeWriter.initError;
            else
                this.isInitialized = true;
        }
        catch (e) {
            this.initError = e instanceof Error ? e : new Error(String(e));
            console.warn('@chaeco/logger: Failed to initialize FileManager:', e);
        }
    }
    async write(message) {
        if (!this.options.enabled)
            return;
        if (!this.isInitialized && !this.initError)
            this.init();
        if (this.initError)
            return;
        if (this.asyncQueue) {
            await this.asyncQueue.enqueue(message);
            return;
        }
        await this.nodeWriter.write(message);
    }
    /** 获取当前文件配置（只读），供 child logger 复制时使用 */
    getOptions() {
        return this.options;
    }
    /** 获取异步写入配置（只读），供 child logger 继承异步策略 */
    getAsyncOptions() {
        return this.asyncOptions;
    }
    /** 关闭存储，刷新剩余队列 */
    async close() {
        await this.asyncQueue?.stop();
    }
    /** 获取异步队列状态 */
    getQueueStatus() {
        return { size: this.asyncQueue?.size ?? 0, isWriting: this.asyncQueue?.writing ?? false };
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=file-manager.js.map