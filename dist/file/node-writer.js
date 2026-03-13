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
exports.NodeWriter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
const util_1 = require("util");
const dayjs_1 = __importDefault(require("dayjs"));
const gzip = (0, util_1.promisify)(zlib.gzip);
const readFile = (0, util_1.promisify)(fs.readFile);
const writeFile = (0, util_1.promisify)(fs.writeFile);
const unlink = (0, util_1.promisify)(fs.unlink);
/**
 * Node.js 文件写入器 - 管理日志文件的创建、轮转、压缩与清理。
 * @internal
 */
class NodeWriter {
    /** 初始化错误（只读），如果初始化失败则值不为 undefined */
    get initError() { return this._initError; }
    constructor(options) {
        this.currentFilePath = '';
        this.currentFileSize = 0;
        this.fileIndex = 0;
        this.options = {
            ...options,
            // 清理文件名中的路径分隔符，防止目录穿越攻击（如 filename: '../../etc/passwd'）
            filename: options.filename.replace(/[/\\]/g, '_'),
        };
    }
    init() {
        this.ensureLogDirectory();
        this.initializeCurrentFile();
    }
    /** 写入单条消息（内部使用 appendFileSync，通过重试逻辑提供可靠性） */
    async write(message) {
        this.checkDateRotation();
        if (this.shouldRotateFile())
            this.rotateFile();
        const content = message + '\n';
        await this.appendToFileWithRetry(content);
        this.currentFileSize += Buffer.byteLength(content, 'utf8');
    }
    /** 批量写入消息（由 AsyncQueue 刷新时调用） */
    async writeBatch(messages) {
        this.checkDateRotation();
        const content = messages.join('\n') + '\n';
        if (this.shouldRotateFile())
            this.rotateFile();
        await this.appendToFileWithRetry(content);
        this.currentFileSize += Buffer.byteLength(content, 'utf8');
    }
    // ─── 私有方法 ────────────────────────────────────────────
    ensureLogDirectory() {
        try {
            if (!fs.existsSync(this.options.path)) {
                fs.mkdirSync(this.options.path, { recursive: true, mode: 0o755 });
            }
        }
        catch (e) {
            this._initError = e instanceof Error ? e : new Error(String(e));
            console.warn(`@chaeco/logger: Failed to create log directory "${this.options.path}":`, this._initError.message);
        }
    }
    initializeCurrentFile() {
        try {
            this.fileIndex = 0;
            // 上界取 maxFiles 的两倍（最少 100），避免目录中存在大量文件时无限扫描
            const maxIndex = Math.max(this.options.maxFiles * 2, 100);
            while (this.fileIndex < maxIndex && fs.existsSync(this.getIndexedFilePath())) {
                this.fileIndex++;
            }
            if (this.fileIndex > 0) {
                this.fileIndex--;
                this.currentFilePath = this.getIndexedFilePath();
                this.currentFileSize = fs.statSync(this.currentFilePath).size;
                if (this.shouldRotateFile()) {
                    this.fileIndex++;
                    this.currentFilePath = this.getIndexedFilePath();
                    this.currentFileSize = 0;
                }
            }
            else {
                this.currentFilePath = this.getIndexedFilePath();
                this.currentFileSize = 0;
            }
        }
        catch (e) {
            this._initError = e instanceof Error ? e : new Error(String(e));
            console.warn('@chaeco/logger: Failed to initialize current file:', this._initError.message);
        }
    }
    getIndexedFilePath() {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const base = `${this.options.filename}-${today}`;
        return this.fileIndex === 0
            ? path.join(this.options.path, `${base}.log`)
            : path.join(this.options.path, `${base}.${this.fileIndex}.log`);
    }
    shouldRotateFile() {
        return this.currentFileSize >= this.options.maxSize;
    }
    rotateFile() {
        this.fileIndex++;
        this.currentFilePath = this.getIndexedFilePath();
        this.currentFileSize = 0;
        this.cleanupOldFiles();
    }
    cleanupOldFiles() {
        try {
            const files = fs.readdirSync(this.options.path)
                .filter(f => f.startsWith(this.options.filename) && (f.endsWith('.log') || f.endsWith('.log.gz')))
                .map(f => {
                const stats = fs.statSync(path.join(this.options.path, f));
                // 优先使用文件名中的日期，避免 mtime 因压缩操作被刷新为近期时间
                const fileDate = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
                const sortKey = fileDate ? new Date(fileDate).getTime() : stats.mtime.getTime();
                return { name: f, path: path.join(this.options.path, f), stats, fileDate, sortKey };
            })
                // 按日期降序（最新在前）；用文件名日期而非 mtime 排序，防止旧压缩日志因近期 mtime 排在前
                .sort((a, b) => b.sortKey - a.sortKey);
            // 超出 maxFiles 的文件：先收集待删集合，避免与过期清理产生重复 unlinkSync 调用
            const toDelete = new Set();
            if (files.length > this.options.maxFiles)
                files.slice(this.options.maxFiles).forEach(f => toDelete.add(f.path));
            const maxAgeMs = this.options.maxAge * 24 * 60 * 60 * 1000;
            files.forEach(f => {
                // 同 compressOldLogs：用文件名日期判断过期，而非 mtime。
                // .log.gz 的 mtime 是压缩时间（近期），用 mtime 会使旧日志看起来永远"新"。
                const ageBasis = f.fileDate ? new Date(f.fileDate).getTime() : f.stats.mtime.getTime();
                if (Date.now() - ageBasis > maxAgeMs)
                    toDelete.add(f.path);
            });
            toDelete.forEach(p => { try {
                fs.unlinkSync(p);
            }
            catch { /* ignore */ } });
            if (this.options.compress)
                this.compressOldLogs().catch(() => { });
        }
        catch { /* ignore cleanup errors */ }
    }
    async compressOldLogs() {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        try {
            const files = fs.readdirSync(this.options.path)
                .filter(f => f.startsWith(this.options.filename) && f.endsWith('.log') && !f.endsWith('.log.gz'))
                .map(f => ({ name: f, path: path.join(this.options.path, f) }));
            for (const file of files) {
                const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
                const fileDate = dateMatch?.[1];
                // 仅压缩文件名日期不是今天的文件，并排除当前写入文件。
                // 不依赖 mtime：跨午夜写入的昨日文件 mtime < 24h 会导致 mtime 条件失效。
                if (fileDate && fileDate !== today && file.path !== this.currentFilePath) {
                    try {
                        const compressed = await gzip(await readFile(file.path));
                        await writeFile(file.path + '.gz', compressed);
                        await unlink(file.path);
                    }
                    catch { /* compress fails silently */ }
                }
            }
        }
        catch { /* ignore */ }
    }
    checkDateRotation() {
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const m = path.basename(this.currentFilePath).match(/(\d{4}-\d{2}-\d{2})/);
        if ((m?.[1] ?? null) !== today)
            this.initializeCurrentFile();
    }
    async appendToFileWithRetry(content) {
        const { retryCount, retryDelay } = this.options;
        let lastError;
        for (let i = 0; i <= retryCount; i++) {
            try {
                if (i > 0)
                    await new Promise(r => setTimeout(r, retryDelay * i));
                this.ensureLogDirectory();
                fs.appendFileSync(this.currentFilePath, content, { mode: 0o644 });
                return;
            }
            catch (e) {
                lastError = e instanceof Error ? e : new Error(String(e));
                if (i === 0)
                    this.initializeCurrentFile();
            }
        }
        console.error(`Failed to write log after ${retryCount + 1} attempts:`, lastError);
        throw lastError;
    }
}
exports.NodeWriter = NodeWriter;
//# sourceMappingURL=node-writer.js.map