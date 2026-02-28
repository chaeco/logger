"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const environment_1 = require("./environment");
// 条件导入 IndexedDB 模块（仅在浏览器环境中）
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let IndexedDBStorage;
if (environment_1.isBrowserEnvironment) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const indexedDBModule = require('@chaeco/indexed-db-storage');
        IndexedDBStorage = indexedDBModule.IndexedDBStorage;
    }
    catch (error) {
        console.warn('@chaeco/logger: Failed to load IndexedDB storage:', error);
    }
}
// 条件导入 Node.js 模块（避免在浏览器环境中加载）
let fs;
let path;
let zlib;
let gzip;
let readFile;
let writeFile;
let unlink;
// 仅在 Node.js 环境中加载模块
if (environment_1.isNodeEnvironment) {
    try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        fs = require('fs');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        path = require('path');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        zlib = require('zlib');
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const { promisify } = require('util');
        if (zlib) {
            gzip = promisify(zlib.gzip);
        }
        if (fs) {
            readFile = promisify(fs.readFile);
            writeFile = promisify(fs.writeFile);
            unlink = promisify(fs.unlink);
        }
    }
    catch (error) {
        console.warn('@chaeco/logger: Failed to load Node.js modules:', error);
    }
}
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
class FileManager {
    constructor(options = {}, asyncOptions) {
        this.currentFilePath = '';
        this.currentFileSize = 0;
        this.fileIndex = 0;
        this.isInitialized = false;
        this.writeQueue = [];
        this.isWriting = false;
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
        // 初始化异步写入配置
        if (asyncOptions?.enabled && environment_1.isNodeEnvironment) {
            this.asyncOptions = {
                enabled: asyncOptions.enabled,
                queueSize: asyncOptions.queueSize ?? 1000,
                batchSize: asyncOptions.batchSize ?? 100,
                flushInterval: asyncOptions.flushInterval ?? 1000,
                overflowStrategy: asyncOptions.overflowStrategy ?? 'drop',
            };
            this.startFlushTimer();
        }
        // 不在构造函数中初始化，而是在首次写入时自动初始化
    }
    /**
     * 初始化文件管理器
     * @remarks
     * 创建日志目录并初始化当前日志文件。
     * 通常不需要手动调用此方法，首次写入日志时会自动初始化。
     * 仅在需要提前确保目录存在时手动调用。
     */
    init() {
        if (this.isInitialized) {
            return;
        }
        try {
            if (environment_1.isNodeEnvironment) {
                this.ensureLogDirectory();
                this.initializeCurrentFile();
                this.isInitialized = true;
            }
            else if (environment_1.isBrowserEnvironment) {
                this.initializeIndexedDB().catch((error) => {
                    this.initError = error instanceof Error ? error : new Error(String(error));
                    console.warn('@chaeco/logger: Failed to initialize IndexedDB storage:', error);
                });
            }
            else {
                console.warn('@chaeco/logger: FileManager 在当前环境中不可用。请在浏览器或 Node.js 中使用。');
            }
        }
        catch (error) {
            this.initError = error instanceof Error ? error : new Error(String(error));
            console.warn('@chaeco/logger: Failed to initialize FileManager:', error);
        }
    }
    async initializeIndexedDB() {
        try {
            this.indexedDBStorage = new IndexedDBStorage({
                dbName: '@chaeco/logger-files',
                storeName: this.options.filename,
                maxRecords: this.options.maxFiles,
                retentionTime: this.options.maxAge * 24 * 60 * 60 * 1000, // 转换为毫秒
                cleanupInterval: 60 * 60 * 1000, // 1 小时
                timestampIndexName: 'timestamp',
            });
            await this.indexedDBStorage.init();
            this.isInitialized = true;
            if (typeof console !== 'undefined') {
                console.log(`✓ IndexedDB storage initialized for ${this.options.filename}`);
            }
        }
        catch (error) {
            console.warn('@chaeco/logger: Failed to initialize IndexedDB:', error);
        }
    }
    ensureLogDirectory() {
        if (!fs || !fs.existsSync) {
            console.warn('@chaeco/logger: fs module not available');
            return;
        }
        try {
            if (!fs.existsSync(this.options.path)) {
                fs.mkdirSync(this.options.path, { recursive: true, mode: this.options.dirMode });
            }
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.initError = err;
            console.warn(`@chaeco/logger: Failed to create log directory "${this.options.path}":`, err.message);
            // 不抛出错误，让日志器继续运行（只是无法写入文件）
        }
    }
    initializeCurrentFile() {
        if (!fs || !path) {
            console.warn('@chaeco/logger: fs or path module not available');
            return;
        }
        try {
            this.fileIndex = 0;
            // 找到今天最后一个已存在的文件索引
            while (fs.existsSync(this.getIndexedFilePath())) {
                this.fileIndex++;
            }
            if (this.fileIndex > 0) {
                // 回退到最后一个已存在的文件
                this.fileIndex--;
                this.currentFilePath = this.getIndexedFilePath();
                this.currentFileSize = fs.statSync(this.currentFilePath).size;
                // 如果该文件已超过大小限制，轮转到新文件
                if (this.shouldRotateFile()) {
                    this.fileIndex++;
                    this.currentFilePath = this.getIndexedFilePath();
                    this.currentFileSize = 0;
                }
            }
            else {
                // 今天还没有日志文件，从索引 0 开始
                this.currentFilePath = this.getIndexedFilePath();
                this.currentFileSize = 0;
            }
        }
        catch (error) {
            const err = error instanceof Error ? error : new Error(String(error));
            this.initError = err;
            console.warn('@chaeco/logger: Failed to initialize current file:', err.message);
        }
    }
    getIndexedFilePath() {
        if (!path) {
            return '';
        }
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const baseName = `${this.options.filename}-${today}`;
        return this.fileIndex === 0
            ? path.join(this.options.path, `${baseName}.log`)
            : path.join(this.options.path, `${baseName}.${this.fileIndex}.log`);
    }
    parseMaxSize(size) {
        const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|m|mb|gb|g)?$/);
        if (!match || !match[1])
            return 10 * 1024 * 1024; // 默认 10MB
        const value = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'b')
            return value * 1;
        if (unit === 'kb')
            return value * 1024;
        if (unit === 'gb' || unit === 'g')
            return value * 1024 * 1024 * 1024;
        return value * 1024 * 1024; // 支持 'm' 和 'mb'
    }
    shouldRotateFile() {
        const maxSize = this.parseMaxSize(this.options.maxSize);
        return this.currentFileSize >= maxSize;
    }
    rotateFile() {
        this.fileIndex++;
        this.currentFilePath = this.getIndexedFilePath();
        this.currentFileSize = 0;
        this.cleanupOldFiles();
    }
    cleanupOldFiles() {
        if (!fs || !path) {
            return;
        }
        try {
            const files = fs
                .readdirSync(this.options.path)
                .filter(file => file.startsWith(this.options.filename) && (file.endsWith('.log') || file.endsWith('.log.gz')))
                .map(file => ({
                name: file,
                path: path.join(this.options.path, file),
                stats: fs.statSync(path.join(this.options.path, file)),
            }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
            // 1. 按数量清理：删除超过 maxFiles 数量的文件
            if (files.length > this.options.maxFiles) {
                const filesToDelete = files.slice(this.options.maxFiles);
                filesToDelete.forEach(file => {
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch (error) {
                        // 忽略删除失败的文件
                    }
                });
            }
            // 2. 按时间清理：删除超过 maxAge 天数的文件
            const now = Date.now();
            const maxAgeMs = this.options.maxAge * 24 * 60 * 60 * 1000;
            files.forEach(file => {
                const fileAge = now - file.stats.mtime.getTime();
                if (fileAge > maxAgeMs) {
                    try {
                        fs.unlinkSync(file.path);
                    }
                    catch (error) {
                        // 忽略删除失败的文件
                    }
                }
            });
            // 3. 压缩旧日志：压缩超过1天的未压缩日志文件
            if (this.options.compress) {
                this.compressOldLogs().catch(_error => {
                    // 静默失败，不影响主流程
                });
            }
        }
        catch (error) {
            // 忽略清理过程中的错误
        }
    }
    /**
     * 压缩旧的日志文件
     * @private
     */
    async compressOldLogs() {
        if (!fs || !path || !readFile || !writeFile || !unlink || !gzip) {
            return;
        }
        try {
            const files = fs
                .readdirSync(this.options.path)
                .filter(file => file.startsWith(this.options.filename) && file.endsWith('.log') && !file.endsWith('.log.gz'))
                .map(file => ({
                name: file,
                path: path.join(this.options.path, file),
                stats: fs.statSync(path.join(this.options.path, file)),
            }));
            const now = Date.now();
            const oneDayMs = 24 * 60 * 60 * 1000;
            const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
            for (const file of files) {
                // 检查文件是否超过1天且不是今天的文件
                const fileAge = now - file.stats.mtime.getTime();
                const isCurrentFile = file.path === this.currentFilePath;
                // 从文件名中提取日期
                const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
                const fileDate = dateMatch ? dateMatch[1] : null;
                if (fileAge > oneDayMs && !isCurrentFile && fileDate && fileDate !== today) {
                    try {
                        // 读取文件内容
                        const content = await readFile(file.path);
                        // 压缩内容
                        const compressed = await gzip(content);
                        // 写入压缩文件
                        await writeFile(file.path + '.gz', compressed);
                        // 删除原文件
                        await unlink(file.path);
                    }
                    catch (error) {
                        // 压缩失败时不删除原文件，静默失败
                    }
                }
            }
        }
        catch (error) {
            // 忽略压缩过程中的错误
        }
    }
    checkDateRotation() {
        if (!path) {
            return;
        }
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        // 使用正则匹配日期，避免 filename 含连字符时解析出错
        const dateMatch = path.basename(this.currentFilePath).match(/(\d{4}-\d{2}-\d{2})/);
        const currentFileDate = dateMatch ? dateMatch[1] : null;
        if (currentFileDate !== today) {
            this.initializeCurrentFile();
        }
    }
    async write(message) {
        if (!this.options.enabled)
            return;
        // 首次写入时自动初始化
        if (!this.isInitialized && !this.initError) {
            this.init();
        }
        // 如果初始化失败，静默返回（日志只输出到控制台）
        if (this.initError) {
            return;
        }
        // 浏览器环境：使用 IndexedDB
        if (environment_1.isBrowserEnvironment && this.indexedDBStorage && this.isInitialized) {
            try {
                const logEntry = {
                    timestamp: Date.now(),
                    date: (0, dayjs_1.default)().format('YYYY-MM-DD'),
                    content: message,
                    size: new Blob([message]).size,
                };
                await this.indexedDBStorage.save(logEntry);
            }
            catch (error) {
                console.error('Failed to write log to IndexedDB:', error);
            }
            return;
        }
        // Node.js 环境：异步写入模式
        if (this.asyncOptions?.enabled) {
            await this.enqueueMessage(message);
            return;
        }
        // Node.js 环境：同步写入模式
        await this.writeToFileWithRetry(message);
    }
    /**
     * 将消息加入异步写入队列
     * @private
     */
    async enqueueMessage(message) {
        if (!this.asyncOptions)
            return;
        // 检查队列是否已满
        if (this.writeQueue.length >= this.asyncOptions.queueSize) {
            switch (this.asyncOptions.overflowStrategy) {
                case 'drop':
                    // 丢弃新消息
                    return;
                case 'block':
                    // 阻塞直到队列有空间（等待刷新）
                    await this.flushQueue();
                    break;
                case 'overflow':
                    // 立即刷新队列，为新消息腾出空间
                    await this.flushQueue();
                    break;
            }
        }
        this.writeQueue.push(message);
        // 如果队列达到批量大小，立即刷新
        if (this.writeQueue.length >= this.asyncOptions.batchSize) {
            await this.flushQueue();
        }
    }
    /**
     * 启动定时刷新器
     * @private
     */
    startFlushTimer() {
        if (this.flushTimer || !this.asyncOptions)
            return;
        this.flushTimer = setInterval(() => {
            if (this.writeQueue.length > 0) {
                this.flushQueue().catch(error => {
                    console.error('Failed to flush log queue:', error);
                });
            }
        }, this.asyncOptions.flushInterval);
    }
    /**
     * 刷新写入队列
     * @private
     */
    async flushQueue() {
        if (this.isWriting || this.writeQueue.length === 0)
            return;
        this.isWriting = true;
        const messages = this.writeQueue.splice(0, this.asyncOptions?.batchSize ?? 100);
        try {
            this.checkDateRotation();
            // 批量写入
            const content = messages.join('\n') + '\n';
            const contentSize = Buffer.byteLength(content, 'utf8');
            // 检查是否需要轮转
            if (this.shouldRotateFile()) {
                this.rotateFile();
            }
            // 写入文件
            await this.appendToFileWithRetry(content);
            this.currentFileSize += contentSize;
        }
        catch (error) {
            console.error('Failed to flush queue:', error);
            // 将消息放回队列头部
            this.writeQueue.unshift(...messages);
        }
        finally {
            this.isWriting = false;
        }
    }
    /**
     * 带重试机制的文件写入
     * @private
     */
    async writeToFileWithRetry(message) {
        this.checkDateRotation();
        if (this.shouldRotateFile()) {
            this.rotateFile();
        }
        const content = message + '\n';
        await this.appendToFileWithRetry(content);
        this.currentFileSize += Buffer.byteLength(content, 'utf8');
    }
    /**
     * 带重试的追加文件内容
     * @private
     */
    async appendToFileWithRetry(content) {
        if (!fs) {
            console.warn('@chaeco/logger: fs module not available');
            return;
        }
        const retryCount = this.options.retryCount;
        const retryDelay = this.options.retryDelay;
        let lastError;
        for (let attempt = 0; attempt <= retryCount; attempt++) {
            try {
                if (attempt > 0) {
                    // 重试延迟（使用配置的 retryDelay）
                    await new Promise(resolve => setTimeout(resolve, retryDelay * attempt));
                }
                // 确保日志目录存在
                this.ensureLogDirectory();
                fs.appendFileSync(this.currentFilePath, content, {
                    mode: this.options.fileMode,
                });
                return; // 成功写入
            }
            catch (error) {
                lastError = error;
                if (attempt === 0) {
                    // 第一次失败时尝试重新初始化文件
                    this.initializeCurrentFile();
                }
            }
        }
        // 所有重试都失败，记录错误
        console.error(`Failed to write log after ${retryCount + 1} attempts:`, lastError);
        throw lastError;
    }
    /**
     * 从 IndexedDB 查询存储的日志（仅浏览器环境）
     */
    async queryLogs(options) {
        if (!environment_1.isBrowserEnvironment || !this.indexedDBStorage || !this.isInitialized) {
            console.warn('queryLogs is only available in browser environment with IndexedDB');
            return [];
        }
        try {
            const result = await this.indexedDBStorage.query({
                limit: options?.limit ?? 100,
                offset: options?.offset ?? 0,
            });
            // 处理 IndexedDB 查询结果
            let logs = [];
            if (Array.isArray(result)) {
                logs = result;
            }
            else if (result && typeof result === 'object' && 'data' in result) {
                const resultObj = result;
                logs = Array.isArray(resultObj.data) ? resultObj.data : [];
            }
            // 如果指定了日期，进行过滤
            if (options?.date) {
                return logs.filter((log) => log.date === options.date);
            }
            return logs;
        }
        catch (error) {
            console.error('Failed to query logs from IndexedDB:', error);
            return [];
        }
    }
    /**
     * 清除 IndexedDB 中的所有日志（仅浏览器环境）
     */
    async clearLogs() {
        if (!environment_1.isBrowserEnvironment || !this.indexedDBStorage || !this.isInitialized) {
            return;
        }
        try {
            await this.indexedDBStorage.clear();
        }
        catch (error) {
            console.error('Failed to clear logs from IndexedDB:', error);
        }
    }
    /**
     * 关闭存储连接
     */
    async close() {
        // 停止定时器
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        // 刷新剩余队列
        if (this.writeQueue.length > 0) {
            await this.flushQueue();
        }
        // 关闭 IndexedDB
        if (this.indexedDBStorage) {
            this.indexedDBStorage.close();
        }
    }
    /**
     * 获取队列状态
     */
    getQueueStatus() {
        return {
            size: this.writeQueue.length,
            isWriting: this.isWriting,
        };
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=file-manager.js.map