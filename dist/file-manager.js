"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FileManager = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dayjs_1 = __importDefault(require("dayjs"));
const environment_1 = require("./environment");
const indexed_db_storage_1 = require("@chaeco/indexed-db-storage");
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
    constructor(options = {}) {
        this.currentFilePath = '';
        this.currentFileSize = 0;
        this.fileIndex = 0;
        this.isInitialized = false;
        this.options = {
            enabled: options.enabled ?? true,
            path: options.path ?? './logs',
            maxSize: options.maxSize ?? '10m',
            maxFiles: options.maxFiles ?? 30,
            filename: options.filename ?? 'app',
        };
        if (environment_1.isNodeEnvironment) {
            this.ensureLogDirectory();
            this.initializeCurrentFile();
        }
        else if (environment_1.isBrowserEnvironment) {
            this.initializeIndexedDB().catch((error) => {
                console.warn('@chaeco/logger: Failed to initialize IndexedDB storage:', error);
            });
        }
        else {
            console.warn('@chaeco/logger: FileManager 在当前环境中不可用。请在浏览器或 Node.js 中使用。');
        }
    }
    async initializeIndexedDB() {
        try {
            this.indexedDBStorage = new indexed_db_storage_1.IndexedDBStorage({
                dbName: '@chaeco/logger-files',
                storeName: this.options.filename,
                maxRecords: this.options.maxFiles,
                retentionTime: 30 * 24 * 60 * 60 * 1000, // 30 天
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
        if (!fs.existsSync(this.options.path)) {
            fs.mkdirSync(this.options.path, { recursive: true });
        }
    }
    initializeCurrentFile() {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        this.currentFilePath = path.join(this.options.path, `${this.options.filename}-${today}.log`);
        this.fileIndex = 0;
        // 检查是否需要创建新的文件索引
        while (fs.existsSync(this.getIndexedFilePath())) {
            this.fileIndex++;
        }
        if (this.fileIndex > 0) {
            this.currentFilePath = this.getIndexedFilePath();
        }
        // 获取当前文件大小
        if (fs.existsSync(this.currentFilePath)) {
            this.currentFileSize = fs.statSync(this.currentFilePath).size;
        }
    }
    getIndexedFilePath() {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const baseName = `${this.options.filename}-${today}`;
        return this.fileIndex === 0
            ? path.join(this.options.path, `${baseName}.log`)
            : path.join(this.options.path, `${baseName}.${this.fileIndex}.log`);
    }
    parseMaxSize(size) {
        const units = {
            b: 1,
            kb: 1024,
            mb: 1024 * 1024,
            gb: 1024 * 1024 * 1024,
        };
        const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
        if (!match || !match[1])
            return 10 * 1024 * 1024; // 默认 10MB
        const value = parseFloat(match[1]);
        const unit = match[2];
        if (unit === 'b')
            return value * 1;
        if (unit === 'kb')
            return value * 1024;
        if (unit === 'gb')
            return value * 1024 * 1024 * 1024;
        return value * 1024 * 1024; // 默认 mb
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
        try {
            const files = fs
                .readdirSync(this.options.path)
                .filter(file => file.startsWith(this.options.filename))
                .map(file => ({
                name: file,
                path: path.join(this.options.path, file),
                stats: fs.statSync(path.join(this.options.path, file)),
            }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
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
        }
        catch (error) {
            // 忽略清理过程中的错误
        }
    }
    checkDateRotation() {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const currentFileDate = path
            .basename(this.currentFilePath)
            .split('-')
            .slice(1, 4)
            .join('-')
            .split('.')[0];
        if (currentFileDate !== today) {
            this.initializeCurrentFile();
        }
    }
    async write(message) {
        if (!this.options.enabled)
            return;
        // 浏览器环境：使用 IndexedDB
        if (environment_1.isBrowserEnvironment && this.indexedDBStorage && this.isInitialized) {
            try {
                const logEntry = {
                    timestamp: Date.now(),
                    date: (0, dayjs_1.default)().format('YYYY-MM-DD'),
                    content: message,
                    size: Buffer.byteLength(message, 'utf8'),
                };
                await this.indexedDBStorage.save(logEntry);
            }
            catch (error) {
                console.error('Failed to write log to IndexedDB:', error);
            }
            return;
        }
        // Node.js 环境：使用文件系统
        this.checkDateRotation();
        if (this.shouldRotateFile()) {
            this.rotateFile();
        }
        try {
            fs.appendFileSync(this.currentFilePath, message + '\n');
            this.currentFileSize += Buffer.byteLength(message + '\n', 'utf8');
        }
        catch (error) {
            // 如果写入失败，尝试重新初始化文件
            this.initializeCurrentFile();
            try {
                fs.appendFileSync(this.currentFilePath, message + '\n');
                this.currentFileSize += Buffer.byteLength(message + '\n', 'utf8');
            }
            catch (retryError) {
                // 静默失败，避免日志系统崩溃应用
                console.error('Failed to write log to file:', retryError);
            }
        }
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
                logs = Array.isArray(result.data) ? result.data : [];
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
    close() {
        if (this.indexedDBStorage) {
            this.indexedDBStorage.close();
        }
    }
}
exports.FileManager = FileManager;
//# sourceMappingURL=file-manager.js.map