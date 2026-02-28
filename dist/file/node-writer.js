"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NodeWriter = void 0;
const dayjs_1 = __importDefault(require("dayjs"));
const environment_1 = require("../utils/environment");
// ─── 条件加载 Node.js 模块 ─────────────────────────────────
let fs;
let path;
let zlib;
let gzip;
let readFile;
let writeFile;
let unlink;
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
        if (zlib)
            gzip = promisify(zlib.gzip);
        if (fs) {
            readFile = promisify(fs.readFile);
            writeFile = promisify(fs.writeFile);
            unlink = promisify(fs.unlink);
        }
    }
    catch (e) {
        console.warn('@chaeco/logger: Failed to load Node.js modules:', e);
    }
}
/**
 * Node.js 文件写入器 - 管理日志文件的创建、轮转、压缩与清理。
 * @internal
 */
class NodeWriter {
    constructor(options) {
        this.currentFilePath = '';
        this.currentFileSize = 0;
        this.fileIndex = 0;
        this.options = options;
    }
    init() {
        this.ensureLogDirectory();
        this.initializeCurrentFile();
    }
    /** 同步写入单条消息 */
    async write(message) {
        this.checkDateRotation();
        if (this.shouldRotateFile())
            this.rotateFile();
        const content = message + '\n';
        await this.appendToFileWithRetry(content);
        this.currentFileSize += Buffer.byteLength(content, 'utf8');
    }
    /** 批量写入消息（异步队列刷新路径） */
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
        if (!fs?.existsSync)
            return;
        try {
            if (!fs.existsSync(this.options.path)) {
                fs.mkdirSync(this.options.path, { recursive: true, mode: this.options.dirMode });
            }
        }
        catch (e) {
            this.initError = e instanceof Error ? e : new Error(String(e));
            console.warn(`@chaeco/logger: Failed to create log directory "${this.options.path}":`, this.initError.message);
        }
    }
    initializeCurrentFile() {
        if (!fs || !path)
            return;
        try {
            this.fileIndex = 0;
            while (fs.existsSync(this.getIndexedFilePath()))
                this.fileIndex++;
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
            this.initError = e instanceof Error ? e : new Error(String(e));
            console.warn('@chaeco/logger: Failed to initialize current file:', this.initError.message);
        }
    }
    getIndexedFilePath() {
        if (!path)
            return '';
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const base = `${this.options.filename}-${today}`;
        return this.fileIndex === 0
            ? path.join(this.options.path, `${base}.log`)
            : path.join(this.options.path, `${base}.${this.fileIndex}.log`);
    }
    parseMaxSize(size) {
        const m = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|m|mb|gb|g)?$/);
        if (!m?.[1])
            return 10 * 1024 * 1024;
        const v = parseFloat(m[1]);
        const u = m[2];
        if (u === 'b')
            return v;
        if (u === 'kb')
            return v * 1024;
        if (u === 'gb' || u === 'g')
            return v * 1024 * 1024 * 1024;
        return v * 1024 * 1024; // m / mb
    }
    shouldRotateFile() {
        return this.currentFileSize >= this.parseMaxSize(this.options.maxSize);
    }
    rotateFile() {
        this.fileIndex++;
        this.currentFilePath = this.getIndexedFilePath();
        this.currentFileSize = 0;
        this.cleanupOldFiles();
    }
    cleanupOldFiles() {
        if (!fs || !path)
            return;
        try {
            const files = fs.readdirSync(this.options.path)
                .filter(f => f.startsWith(this.options.filename) && (f.endsWith('.log') || f.endsWith('.log.gz')))
                .map(f => ({ name: f, path: path.join(this.options.path, f), stats: fs.statSync(path.join(this.options.path, f)) }))
                .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
            if (files.length > this.options.maxFiles)
                files.slice(this.options.maxFiles).forEach(f => { try {
                    fs.unlinkSync(f.path);
                }
                catch { /* ignore */ } });
            const maxAgeMs = this.options.maxAge * 24 * 60 * 60 * 1000;
            files.forEach(f => {
                if (Date.now() - f.stats.mtime.getTime() > maxAgeMs)
                    try {
                        fs.unlinkSync(f.path);
                    }
                    catch { /* ignore */ }
            });
            if (this.options.compress)
                this.compressOldLogs().catch(() => { });
        }
        catch { /* ignore cleanup errors */ }
    }
    async compressOldLogs() {
        if (!fs || !path || !readFile || !writeFile || !unlink || !gzip)
            return;
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const oneDayMs = 24 * 60 * 60 * 1000;
        try {
            const files = fs.readdirSync(this.options.path)
                .filter(f => f.startsWith(this.options.filename) && f.endsWith('.log') && !f.endsWith('.log.gz'))
                .map(f => ({ name: f, path: path.join(this.options.path, f), stats: fs.statSync(path.join(this.options.path, f)) }));
            for (const file of files) {
                const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/);
                const fileDate = dateMatch?.[1];
                if (Date.now() - file.stats.mtime.getTime() > oneDayMs && file.path !== this.currentFilePath && fileDate && fileDate !== today) {
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
        if (!path)
            return;
        const today = (0, dayjs_1.default)().format('YYYY-MM-DD');
        const m = path.basename(this.currentFilePath).match(/(\d{4}-\d{2}-\d{2})/);
        if ((m?.[1] ?? null) !== today)
            this.initializeCurrentFile();
    }
    async appendToFileWithRetry(content) {
        if (!fs) {
            console.warn('@chaeco/logger: fs module not available');
            return;
        }
        const { retryCount, retryDelay } = this.options;
        let lastError;
        for (let i = 0; i <= retryCount; i++) {
            try {
                if (i > 0)
                    await new Promise(r => setTimeout(r, retryDelay * i));
                this.ensureLogDirectory();
                fs.appendFileSync(this.currentFilePath, content, { mode: this.options.fileMode });
                return;
            }
            catch (e) {
                lastError = e;
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