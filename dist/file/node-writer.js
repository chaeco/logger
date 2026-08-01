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
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeWriter = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const zlib = __importStar(require("zlib"));
const util_1 = require("util");
const date_utils_1 = require("../utils/date-utils");
const unlink = (0, util_1.promisify)(fs.unlink);
/**
 * Node.js 文件写入器 - 管理日志文件的创建、轮转、压缩与清理。
 * @internal
 */
class NodeWriter {
    /** 初始化错误（只读），如果初始化失败则值不为 undefined */
    get initError() {
        return this._initError;
    }
    constructor(options) {
        this.currentFilePath = '';
        this.currentFileSize = 0;
        this.fileIndex = 0;
        // 串行化压缩任务：下一次压缩等待上一次完成后再起，避免并发读写竞态
        this.compressPromise = Promise.resolve();
        this.compressionPending = false;
        this.options = {
            ...options,
            // 清理文件名中的路径分隔符，防止目录穿越攻击（如 filename: '../../etc/passwd'）
            filename: options.filename.replace(/[/\\]/g, '_'),
        };
    }
    init() {
        this.ensureLogDirectory();
        this.initializeCurrentFile();
        this.cleanupOldFiles();
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
        const today = (0, date_utils_1.formatNow)('YYYY-MM-DD');
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
            this.pruneExpiredFiles();
            if (this.options.compress && !this.compressionPending) {
                this.compressionPending = true;
                this.compressPromise = this.compressPromise
                    .then(async () => {
                    await this.compressOldLogs();
                    this.pruneFilesByCount();
                    this.compressionPending = false;
                })
                    .catch(() => {
                    this.compressionPending = false;
                });
            }
            else if (!this.options.compress) {
                this.pruneFilesByCount();
            }
        }
        catch {
            /* ignore cleanup errors */
        }
    }
    async compressOldLogs() {
        const today = (0, date_utils_1.formatNow)('YYYY-MM-DD');
        try {
            const files = fs
                .readdirSync(this.options.path)
                .filter((f) => f.startsWith(this.options.filename) && f.endsWith('.log') && !f.endsWith('.log.gz'))
                .map((f) => ({ name: f, path: path.join(this.options.path, f) }));
            // 按日期分组，跳过今天和当前正在写入的文件
            const byDate = new Map();
            for (const file of files) {
                const fileDate = file.name.match(/(\d{4}-\d{2}-\d{2})/)?.[1];
                if (!fileDate || fileDate === today || file.path === this.currentFilePath)
                    continue;
                if (!byDate.has(fileDate))
                    byDate.set(fileDate, []);
                byDate.get(fileDate).push(file);
            }
            for (const [fileDate, dateFiles] of byDate) {
                // 按分片索引升序排列，保证内容时序正确
                // app-date.log → 0，app-date.1.log → 1，app-date.72.log → 72
                dateFiles.sort((a, b) => {
                    const ai = parseInt(a.name.match(/\d{4}-\d{2}-\d{2}\.(\d+)\.log$/)?.[1] ?? '0');
                    const bi = parseInt(b.name.match(/\d{4}-\d{2}-\d{2}\.(\d+)\.log$/)?.[1] ?? '0');
                    return ai - bi;
                });
                const gzPath = path.join(this.options.path, `${this.options.filename}-${fileDate}.log.gz`);
                const tmpPath = `${gzPath}.tmp`;
                const hasExistingArchive = fs.existsSync(gzPath);
                const sourceArchivePath = hasExistingArchive ? `${gzPath}.bak` : undefined;
                try {
                    if (hasExistingArchive && sourceArchivePath)
                        fs.renameSync(gzPath, sourceArchivePath);
                    // 流式压缩：每个分片逐块读取写入 gzip，不在内存中累积全部内容
                    await this.streamCompressDayFiles(dateFiles, tmpPath, sourceArchivePath);
                    // 原子替换：先写 .tmp，成功后 rename，保证中途失败不损坏目标
                    fs.renameSync(tmpPath, gzPath);
                    if (sourceArchivePath) {
                        try {
                            fs.unlinkSync(sourceArchivePath);
                        }
                        catch {
                            /* ignore */
                        }
                    }
                    // rename 成功后再删除原始分片
                    for (const file of dateFiles) {
                        try {
                            await unlink(file.path);
                        }
                        catch {
                            /* ignore */
                        }
                    }
                }
                catch {
                    // 清理残留临时文件
                    try {
                        fs.unlinkSync(tmpPath);
                    }
                    catch {
                        /* ignore */
                    }
                    if (sourceArchivePath && fs.existsSync(sourceArchivePath) && !fs.existsSync(gzPath)) {
                        try {
                            fs.renameSync(sourceArchivePath, gzPath);
                        }
                        catch {
                            /* ignore */
                        }
                    }
                }
            }
        }
        catch {
            /* ignore */
        }
    }
    listManagedFiles() {
        return fs
            .readdirSync(this.options.path)
            .filter((f) => f.startsWith(this.options.filename) && (f.endsWith('.log') || f.endsWith('.log.gz')))
            .map((f) => {
            const stats = fs.statSync(path.join(this.options.path, f));
            const filePath = path.join(this.options.path, f);
            const fileDate = f.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? null;
            const sortKey = fileDate ? new Date(fileDate).getTime() : stats.mtime.getTime();
            const shardIndex = this.getShardIndex(f);
            return {
                name: f,
                path: filePath,
                stats,
                fileDate,
                sortKey,
                shardIndex,
                isCurrent: filePath === this.currentFilePath,
            };
        })
            .sort((a, b) => {
            if (b.sortKey !== a.sortKey)
                return b.sortKey - a.sortKey;
            if (a.isCurrent !== b.isCurrent)
                return a.isCurrent ? -1 : 1;
            if (b.shardIndex !== a.shardIndex)
                return b.shardIndex - a.shardIndex;
            if (b.stats.mtime.getTime() !== a.stats.mtime.getTime())
                return b.stats.mtime.getTime() - a.stats.mtime.getTime();
            return b.name.localeCompare(a.name);
        });
    }
    getShardIndex(fileName) {
        if (fileName.endsWith('.log.gz'))
            return Number.MAX_SAFE_INTEGER;
        return parseInt(fileName.match(/\d{4}-\d{2}-\d{2}\.(\d+)\.log$/)?.[1] ?? '0');
    }
    pruneExpiredFiles() {
        const maxAgeMs = this.options.maxAge * NodeWriter.ONE_DAY_MS;
        for (const file of this.listManagedFiles()) {
            const ageBasis = file.fileDate
                ? new Date(file.fileDate).getTime()
                : file.stats.mtime.getTime();
            if (Date.now() - ageBasis > maxAgeMs) {
                try {
                    fs.unlinkSync(file.path);
                }
                catch {
                    /* ignore */
                }
            }
        }
    }
    pruneFilesByCount() {
        const files = this.listManagedFiles();
        if (files.length <= this.options.maxFiles)
            return;
        for (const file of files.slice(this.options.maxFiles)) {
            try {
                fs.unlinkSync(file.path);
            }
            catch {
                /* ignore */
            }
        }
    }
    /**
     * 将多个分片文件流式合并压缩为单个 gzip 文件。
     * 逐块读取，内存占用与分片大小无关，适合大文件场景。
     */
    streamCompressDayFiles(dateFiles, outPath, existingArchivePath) {
        return new Promise((resolve, reject) => {
            const gzipStream = zlib.createGzip();
            const outStream = fs.createWriteStream(outPath);
            const sources = [];
            if (existingArchivePath)
                sources.push({ path: existingArchivePath, compressed: true });
            dateFiles.forEach((file) => sources.push({ path: file.path, compressed: false }));
            gzipStream.pipe(outStream);
            outStream.on('finish', resolve);
            outStream.on('error', reject);
            gzipStream.on('error', reject);
            let i = 0;
            const pipeNext = () => {
                if (i >= sources.length) {
                    gzipStream.end();
                    return;
                }
                const source = sources[i++];
                let lastByte = null;
                const readStream = fs.createReadStream(source.path);
                let sourceStream = readStream;
                readStream.on('error', reject);
                if (source.compressed) {
                    const gunzipStream = zlib.createGunzip();
                    gunzipStream.on('error', reject);
                    sourceStream = readStream.pipe(gunzipStream);
                }
                sourceStream.on('data', (chunk) => {
                    const buf = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
                    if (buf.length > 0)
                        lastByte = buf[buf.length - 1];
                });
                sourceStream.on('end', () => {
                    // 确保每个分片末尾有换行，避免拼接时相邻行粘连
                    if (lastByte !== null && lastByte !== 0x0a && i < sources.length) {
                        gzipStream.write(Buffer.from('\n'));
                    }
                    pipeNext();
                });
                sourceStream.pipe(gzipStream, { end: false });
            };
            pipeNext();
        });
    }
    checkDateRotation() {
        const today = (0, date_utils_1.formatNow)('YYYY-MM-DD');
        const m = path.basename(this.currentFilePath).match(/(\d{4}-\d{2}-\d{2})/);
        if ((m?.[1] ?? null) !== today) {
            this.initializeCurrentFile();
            this.cleanupOldFiles();
        }
    }
    async appendToFileWithRetry(content) {
        const { retryCount, retryDelay } = this.options;
        let lastError;
        for (let i = 0; i <= retryCount; i++) {
            try {
                if (i > 0)
                    await new Promise((r) => setTimeout(r, retryDelay * i));
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
NodeWriter.ONE_DAY_MS = 24 * 60 * 60 * 1000;
//# sourceMappingURL=node-writer.js.map