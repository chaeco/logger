'use strict';

var fs = require('fs');
var path = require('path');
var zlib = require('zlib');
var util = require('util');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var fs__namespace = /*#__PURE__*/_interopNamespaceDefault(fs);
var path__namespace = /*#__PURE__*/_interopNamespaceDefault(path);
var zlib__namespace = /*#__PURE__*/_interopNamespaceDefault(zlib);

/**
 * 原生日期格式化工具，替代 dayjs。
 * 支持格式令牌：YYYY MM DD HH mm ss SSS
 * @internal
 */
function pad(n, len = 2) {
    return String(n).padStart(len, '0');
}
/**
 * 将日期按指定格式输出字符串。
 * @param date  - Date 对象、ISO 字符串或时间戳（毫秒）
 * @param format - 格式字符串，支持 YYYY MM DD HH mm ss SSS
 */
function formatDate(date, format) {
    const d = date instanceof Date ? date : new Date(date);
    return format
        .replace('YYYY', String(d.getFullYear()))
        .replace('MM', pad(d.getMonth() + 1))
        .replace('DD', pad(d.getDate()))
        .replace('HH', pad(d.getHours()))
        .replace('mm', pad(d.getMinutes()))
        .replace('ss', pad(d.getSeconds()))
        .replace('SSS', pad(d.getMilliseconds(), 3));
}
/** 以指定格式输出当前时间字符串。 */
function formatNow(format) {
    return formatDate(new Date(), format);
}

const unlink = util.promisify(fs__namespace.unlink);
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
            if (!fs__namespace.existsSync(this.options.path)) {
                fs__namespace.mkdirSync(this.options.path, { recursive: true, mode: 0o755 });
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
            while (this.fileIndex < maxIndex && fs__namespace.existsSync(this.getIndexedFilePath())) {
                this.fileIndex++;
            }
            if (this.fileIndex > 0) {
                this.fileIndex--;
                this.currentFilePath = this.getIndexedFilePath();
                this.currentFileSize = fs__namespace.statSync(this.currentFilePath).size;
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
        const today = formatNow('YYYY-MM-DD');
        const base = `${this.options.filename}-${today}`;
        return this.fileIndex === 0
            ? path__namespace.join(this.options.path, `${base}.log`)
            : path__namespace.join(this.options.path, `${base}.${this.fileIndex}.log`);
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
        const today = formatNow('YYYY-MM-DD');
        try {
            const files = fs__namespace
                .readdirSync(this.options.path)
                .filter((f) => f.startsWith(this.options.filename) && f.endsWith('.log') && !f.endsWith('.log.gz'))
                .map((f) => ({ name: f, path: path__namespace.join(this.options.path, f) }));
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
                const gzPath = path__namespace.join(this.options.path, `${this.options.filename}-${fileDate}.log.gz`);
                const tmpPath = `${gzPath}.tmp`;
                const hasExistingArchive = fs__namespace.existsSync(gzPath);
                const sourceArchivePath = hasExistingArchive ? `${gzPath}.bak` : undefined;
                try {
                    if (hasExistingArchive && sourceArchivePath)
                        fs__namespace.renameSync(gzPath, sourceArchivePath);
                    // 流式压缩：每个分片逐块读取写入 gzip，不在内存中累积全部内容
                    await this.streamCompressDayFiles(dateFiles, tmpPath, sourceArchivePath);
                    // 原子替换：先写 .tmp，成功后 rename，保证中途失败不损坏目标
                    fs__namespace.renameSync(tmpPath, gzPath);
                    if (sourceArchivePath) {
                        try {
                            fs__namespace.unlinkSync(sourceArchivePath);
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
                        fs__namespace.unlinkSync(tmpPath);
                    }
                    catch {
                        /* ignore */
                    }
                    if (sourceArchivePath && fs__namespace.existsSync(sourceArchivePath) && !fs__namespace.existsSync(gzPath)) {
                        try {
                            fs__namespace.renameSync(sourceArchivePath, gzPath);
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
        return fs__namespace
            .readdirSync(this.options.path)
            .filter((f) => f.startsWith(this.options.filename) && (f.endsWith('.log') || f.endsWith('.log.gz')))
            .map((f) => {
            const stats = fs__namespace.statSync(path__namespace.join(this.options.path, f));
            const filePath = path__namespace.join(this.options.path, f);
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
                    fs__namespace.unlinkSync(file.path);
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
                fs__namespace.unlinkSync(file.path);
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
            const gzipStream = zlib__namespace.createGzip();
            const outStream = fs__namespace.createWriteStream(outPath);
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
                const readStream = fs__namespace.createReadStream(source.path);
                let sourceStream = readStream;
                readStream.on('error', reject);
                if (source.compressed) {
                    const gunzipStream = zlib__namespace.createGunzip();
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
        const today = formatNow('YYYY-MM-DD');
        const m = path__namespace.basename(this.currentFilePath).match(/(\d{4}-\d{2}-\d{2})/);
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
                fs__namespace.appendFileSync(this.currentFilePath, content, { mode: 0o644 });
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
NodeWriter.ONE_DAY_MS = 24 * 60 * 60 * 1000;

/**
 * 异步写入队列 - 批量缓冲日志消息，按批次大小或定时间隔写入。
 * @internal
 */
class AsyncQueue {
    constructor(options, onFlush) {
        this.queue = [];
        this.isWriting = false;
        this.isStopping = false;
        this.options = options;
        this.onFlush = onFlush;
    }
    get size() {
        return this.queue.length;
    }
    get writing() {
        return this.isWriting;
    }
    /** 启动定时刷新器 */
    start() {
        if (this.flushTimer)
            return;
        this.flushTimer = setInterval(() => {
            if (this.queue.length > 0) {
                this.flush().catch((e) => console.error('Failed to flush log queue:', e));
            }
        }, this.options.flushInterval);
        // unref 使定时器不阻止进程自然退出（进程中只剩这个定时器时可以退出）
        this.flushTimer.unref?.();
    }
    /** 将消息加入队列 */
    async enqueue(message) {
        // 关闭期间拒绝新消息，避免 stop() 提前终止
        if (this.isStopping)
            return;
        // 用 while 而非 if：flush 失败时消息会被退回队列，队列仍可能满，需重新判断。
        // 若一直用 if，flush 失败后依然 push，队列长度将无限突破 queueSize 上界。
        while (this.queue.length >= this.options.queueSize) {
            if (this.options.overflowStrategy === 'drop')
                return;
            // 'block': 等待当前批次写完后继续入队
            if (this.isWriting) {
                // 正在写入时不要忙等，给正在进行的 flush 一点完成时间
                await new Promise((r) => setTimeout(r, 10));
            }
            else {
                await this.flush();
            }
        }
        this.queue.push(message);
        if (this.queue.length >= this.options.batchSize) {
            await this.flush();
        }
    }
    /** 立即刷新队列 */
    async flush() {
        if (this.isWriting || this.queue.length === 0)
            return;
        this.isWriting = true;
        const messages = this.queue.splice(0, this.options.batchSize);
        try {
            await this.onFlush(messages);
        }
        catch (e) {
            console.error('Failed to flush queue:', e);
            this.queue.unshift(...messages);
        }
        finally {
            this.isWriting = false;
        }
    }
    /** 停止定时器并持续刷新直到队列完全清空 */
    async stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        this.isStopping = true;
        // 循环直到队列彻底清空（每次最多写 batchSize 条）。
        // 若 onFlush 持续失败，flush() 会将消息退回队列，此处设置最大重试轮次防止死循环。
        // FLUSH_SAFETY_BUFFER 额外轮次：防止 onFlush 间歇性失败时循环提前终止。
        const FLUSH_SAFETY_BUFFER = 3;
        const maxAttempts = Math.ceil(this.queue.length / this.options.batchSize) + FLUSH_SAFETY_BUFFER;
        let attempts = 0;
        while (this.queue.length > 0 && attempts < maxAttempts) {
            if (this.isWriting) {
                // 如果当前正在进行 flush（可能来自 setInterval），等待一小段时间再重试
                await new Promise((r) => setTimeout(r, 10));
                attempts++;
                continue;
            }
            await this.flush();
            attempts++;
        }
        if (this.queue.length > 0) {
            console.error(`@chaeco/logger: AsyncQueue stopped with ${this.queue.length} unwritten messages (flush failed repeatedly)`);
        }
    }
}

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
        this.nodeWriter = new NodeWriter(this.options);
        if (asyncOptions?.enabled) {
            const ao = {
                enabled: asyncOptions.enabled,
                queueSize: asyncOptions.queueSize ?? 5000,
                batchSize: asyncOptions.batchSize ?? 200,
                flushInterval: asyncOptions.flushInterval ?? 500,
                overflowStrategy: asyncOptions.overflowStrategy ?? 'block',
            };
            this.asyncQueue = new AsyncQueue(ao, (msgs) => this.nodeWriter.writeBatch(msgs));
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
        if (this.initError) {
            // 存在之前的初始化失败，尝试重新初始化
            this.initError = undefined;
            this.isInitialized = false;
            this.init();
            if (this.initError)
                return;
        }
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

/**
 * 调用栈解析工具
 * @internal
 * 负责从 Error 堆栈中提取调用日志方法的文件路径和行号，并带 LRU 缓存。
 */
class CallerInfoHelper {
    constructor(maxCacheSize = 1000) {
        this.cache = new Map();
        this.maxCacheSize = maxCacheSize;
    }
    /**
     * 获取当前调用者的文件路径和行号
     */
    getCallerInfo() {
        const error = new Error();
        const stack = error.stack;
        if (!stack)
            return {};
        // 使用堆栈字符串作为缓存键（无需哈希，字符串本身是唯一标识）
        if (this.cache.has(stack)) {
            // 缓存命中：重新插入到末尾实现 LRU 淘汰
            const result = this.cache.get(stack);
            this.cache.delete(stack);
            this.cache.set(stack, result);
            return result;
        }
        // 解析堆栈信息
        const stackLines = stack.split('\n');
        for (let i = 0; i < stackLines.length; i++) {
            const line = stackLines[i]?.trim();
            if (!line)
                continue;
            // 跳过 Error 本身的行（V8 堆栈首行）
            if (line.startsWith('Error'))
                continue;
            // 跳过所有 logger 内部帧
            if (line.includes('Logger.log') ||
                line.includes('Logger.info') ||
                line.includes('Logger.warn') ||
                line.includes('Logger.error') ||
                line.includes('Logger.debug') ||
                line.includes('Logger.createLogEntry') ||
                line.includes('getCallerInfo') ||
                line.includes('CallerInfoHelper')) {
                continue;
            }
            // 匹配文件路径和行号
            const match = line.match(/\((.+?):(\d+):\d+\)$/) || line.match(/at (.+?):(\d+):\d+$/);
            if (match && match[1] && match[2]) {
                const filePath = match[1];
                const lineNumber = parseInt(match[2], 10);
                // 排除 Node.js 内部文件和 logger 模块文件
                if (filePath &&
                    !filePath.includes('@chaeco/logger') &&
                    !filePath.includes('node:internal') &&
                    !filePath.includes('node_modules') &&
                    !filePath.startsWith('node:')) {
                    // 使用 process.cwd() 裁剪为相对路径
                    let simplifiedPath = filePath;
                    try {
                        const cwd = process.cwd();
                        if (filePath.startsWith(cwd)) {
                            simplifiedPath = filePath.slice(cwd.length).replace(/^[/\\]/, '');
                        }
                    }
                    catch {
                        // 忽略路径简化失败
                    }
                    const result = { file: simplifiedPath, line: lineNumber };
                    this.cacheResult(stack, result);
                    return result;
                }
            }
        }
        return {};
    }
    /** 清除缓存 */
    clearCache() {
        this.cache.clear();
    }
    /** 获取缓存大小（调试用） */
    getCacheSize() {
        return this.cache.size;
    }
    /** LRU 缓存写入：满时淘汰最旧项 */
    cacheResult(key, info) {
        if (this.cache.size >= this.maxCacheSize) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }
        this.cache.set(key, info);
    }
}

const ansi = (code) => (text) => `\x1b[${code}m${text}\x1b[0m`;
const GRAY = ansi(90);
const BLUE = ansi(34);
const YELLOW = ansi(33);
const RED = ansi(31);
const WHITE = ansi(37);
const CYAN = ansi(36);
/**
 * 颜色工具类
 * @internal
 * @remarks
 * 用于处理控制台输出的颜色。为不同级别的日志提供不同的颜色显示。
 */
class ColorUtils {
    static getLevelColor(level) {
        switch (level.toLowerCase()) {
            case 'debug':
                return GRAY;
            case 'info':
                return BLUE;
            case 'warn':
                return YELLOW;
            case 'error':
                return RED;
            default:
                return WHITE;
        }
    }
    static colorizeLevel(level) {
        const color = this.getLevelColor(level);
        return color(level.toUpperCase().padEnd(6));
    }
    /**
     * 将时间戳渲染为灰色，内部添加方括号（与 colorizeName / colorizeFileLocation 约定一致）
     */
    static colorizeTimestamp(timestamp) {
        return GRAY(`[${timestamp}]`);
    }
    static colorizeName(name) {
        return CYAN(`[${name}]`);
    }
    static colorizeFileLocation(location) {
        return GRAY(`(${location})`);
    }
    static colorizeMessage(level, message) {
        const color = this.getLevelColor(level);
        return color(message);
    }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 日志格式化器
 * @internal
 * 负责将 LogEntry 转换为可输出的字符串，支持普通文本、彩色控制台和 JSON 格式。
 */
class LogFormatter {
    constructor(settings) {
        this.settings = settings;
    }
    /**
     * 更新格式化选项（支持部分更新）
     */
    updateFormat(options) {
        const f = this.settings.format;
        if (options.enabled !== undefined)
            f.enabled = options.enabled;
        if (options.timestampFormat !== undefined)
            f.timestampFormat = options.timestampFormat;
        if (options.formatter !== undefined)
            f.formatter = options.formatter;
        if (options.includeStack !== undefined)
            f.includeStack = options.includeStack;
        if (options.includeName !== undefined)
            f.includeName = options.includeName;
        if (options.json !== undefined)
            f.json = options.json;
        if (options.jsonIndent !== undefined)
            f.jsonIndent = options.jsonIndent;
    }
    // ─── 公开格式化方法 ───────────────────────────────────────
    /**
     * 格式化为文件输出字符串。
     * 注意：文件日志始终包含时间戳，与控制台的 consoleTimestamp 开关无关。
     */
    formatMessage(entry) {
        const { format } = this.settings;
        // 自定义格式化函数
        if (format.enabled && format.formatter) {
            try {
                return format.formatter(entry);
            }
            catch (error) {
                console.error('Error in custom formatter:', error);
                // 降级到默认格式
            }
        }
        // JSON 格式输出
        if (format.json) {
            const jsonEntry = {
                timestamp: entry.timestamp,
                level: entry.level,
                message: entry.message,
            };
            if (format.includeName && entry.name)
                jsonEntry.name = entry.name;
            if (format.includeStack && entry.file && entry.line) {
                jsonEntry.file = entry.file;
                jsonEntry.line = entry.line;
            }
            if (entry.data !== undefined)
                jsonEntry.data = entry.data;
            return this.safeStringify(jsonEntry, format.jsonIndent);
        }
        // 默认格式：文件日志始终包含时间戳
        return this.buildPlainText(entry, true);
    }
    /**
     * 格式化为带 ANSI 颜色的控制台字符串。
     * 无色模式下使用纯文本，且遵守 consoleTimestamp 开关（与文件格式独立）。
     * 自定义 formatter 函数的优先级高于颜色开关。
     */
    formatConsoleMessage(entry) {
        const { consoleColors, consoleTimestamp, format } = this.settings;
        // 自定义格式化函数优先——无论是否启用颜色，均走自定义逻辑
        if (format.enabled && format.formatter) {
            try {
                return format.formatter(entry);
            }
            catch (error) {
                console.error('Error in custom formatter:', error);
                // 降级到默认格式
            }
        }
        if (!consoleColors) {
            // 无色模式：纯文本，遵守 consoleTimestamp 开关。
            // 不能调用 formatMessage()，因为文件格式始终包含时间戳，两者策略不同。
            return this.buildPlainText(entry, consoleTimestamp);
        }
        const parts = [];
        if (consoleTimestamp) {
            parts.push(ColorUtils.colorizeTimestamp(entry.timestamp));
        }
        if (entry.name)
            parts.push(ColorUtils.colorizeName(entry.name));
        parts.push(ColorUtils.colorizeLevel(entry.level));
        if (entry.file && entry.line) {
            parts.push(ColorUtils.colorizeFileLocation(`${entry.file}:${entry.line}`));
        }
        parts.push(ColorUtils.colorizeMessage(entry.level, entry.message));
        if (entry.data !== undefined)
            parts.push(this.safeStringify(entry.data));
        return parts.join(' ');
    }
    // ─── 私有辅助 ───────────────────────────────────────────────
    /**
     * 构建纯文本日志行，供文件输出和无色控制台复用。
     * @param includeTimestamp 是否包含时间戳（文件格式始终传 true；控制台按 consoleTimestamp 传入）
     */
    buildPlainText(entry, includeTimestamp) {
        const { format } = this.settings;
        const parts = [];
        if (includeTimestamp) {
            const ts = formatDate(entry.timestamp, format.timestampFormat);
            parts.push(`[${ts}]`);
        }
        if (format.includeName && entry.name)
            parts.push(`[${entry.name}]`);
        parts.push(entry.level.toUpperCase().padEnd(6));
        if (format.includeStack && entry.file && entry.line) {
            parts.push(`(${entry.file}:${entry.line})`);
        }
        parts.push(entry.message);
        if (entry.data !== undefined)
            parts.push(this.safeStringify(entry.data));
        return parts.join(' ');
    }
    /**
     * 安全的 JSON 序列化，处理循环引用
     */
    safeStringify(obj, indent) {
        // 基础类型直接返回或使用默认序列化，提升性能
        if (obj === null || typeof obj !== 'object')
            return String(obj);
        try {
            // 只有对象才需要 WeakSet 检查循环引用
            const seen = new WeakSet();
            return JSON.stringify(obj, (_key, value) => {
                if (typeof value === 'object' && value !== null) {
                    if (seen.has(value))
                        return '[Circular]';
                    seen.add(value);
                }
                return value;
            }, indent);
        }
        catch {
            try {
                return String(obj);
            }
            catch {
                return '[Unable to serialize]';
            }
        }
    }
}

/**
 * 日志器主类
 * @remarks
 * 扁平结构，无继承。支持多级别日志、彩色控制台输出、文件写入、事件钩子与子 Logger。
 * 仅支持 Node.js 运行时。
 */
class Logger {
    constructor(options = {}, sharedFileManager) {
        this.callerInfoHelper = new CallerInfoHelper();
        this.errorHandling = {
            silent: true,
            onError: undefined,
            fallbackToConsole: true,
        };
        this.eventHandlers = new Map();
        this.levelPriority = {
            debug: 0,
            info: 1,
            warn: 2,
            error: 3,
            silent: 999,
        };
        this.level = options.level ?? 'info';
        this.name = options.name;
        this.ownsFileManager = !sharedFileManager;
        this.fileEnabled = options.file?.enabled ?? true;
        if (sharedFileManager) {
            this.fileManager = sharedFileManager;
        }
        else if (options.file?.enabled !== false) {
            this.fileManager = new FileManager(options.file, options.async);
        }
        this.consoleEnabled = options.console?.enabled ?? true;
        this.formatter = new LogFormatter({
            consoleColors: options.console?.colors ?? true,
            consoleTimestamp: options.console?.timestamp ?? true,
            format: {
                enabled: options.format?.enabled ?? false,
                timestampFormat: options.format?.timestampFormat ?? 'YYYY-MM-DD HH:mm:ss.SSS',
                formatter: options.format?.formatter,
                includeStack: options.format?.includeStack ?? true,
                includeName: options.format?.includeName ?? true,
                json: options.format?.json ?? false,
                jsonIndent: options.format?.jsonIndent ?? 0,
            },
        });
        if (options.errorHandling)
            this.configureErrorHandling(options.errorHandling);
    }
    // ─── 初始化 ──────────────────────────────────────────────
    init() {
        this.fileManager?.init();
    }
    // ─── 核心日志方法 ─────────────────────────────────────────
    debug(...args) {
        this.log('debug', ...args);
    }
    info(...args) {
        this.log('info', ...args);
    }
    warn(...args) {
        this.log('warn', ...args);
    }
    error(...args) {
        this.log('error', ...args);
    }
    // ─── 等级控制 ─────────────────────────────────────────────
    setLevel(level) {
        const old = this.level;
        this.level = level;
        this.emitEvent('levelChange', `日志等级已从 ${old} 更改为 ${level}`, undefined, {
            oldLevel: old,
            newLevel: level,
        });
    }
    getLevel() {
        return this.level;
    }
    // ─── 配置 ─────────────────────────────────────────────────
    configureFormat(options) {
        this.formatter.updateFormat(options);
    }
    configureErrorHandling(options) {
        if (options.silent !== undefined)
            this.errorHandling.silent = options.silent;
        if (options.onError !== undefined)
            this.errorHandling.onError = options.onError;
        if (options.fallbackToConsole !== undefined)
            this.errorHandling.fallbackToConsole = options.fallbackToConsole;
    }
    async updateConfig(options) {
        if (options.level !== undefined)
            this.setLevel(options.level);
        if (options.console !== undefined) {
            this.consoleEnabled = options.console.enabled ?? this.consoleEnabled;
            this.formatter.settings.consoleColors =
                options.console.colors ?? this.formatter.settings.consoleColors;
            this.formatter.settings.consoleTimestamp =
                options.console.timestamp ?? this.formatter.settings.consoleTimestamp;
        }
        if (options.file !== undefined) {
            this.fileEnabled = options.file.enabled ?? this.fileEnabled;
            if (options.file.enabled === false) {
                if (this.fileManager && this.ownsFileManager) {
                    try {
                        await this.fileManager.close();
                    }
                    catch (e) {
                        // 关闭失败（如异步队列仍有数据）时提示，避免静默丢日志
                        console.warn('@chaeco/logger: Failed to close FileManager while disabling file output:', e instanceof Error ? e.message : String(e));
                    }
                }
                if (this.ownsFileManager)
                    this.fileManager = undefined;
            }
            else if (!this.fileManager) {
                this.fileManager = new FileManager(options.file, options.async);
            }
            else if (this.ownsFileManager) {
                // 文件配置变更时重建 FileManager（路径/轮转/压缩/异步策略）
                try {
                    await this.fileManager.close();
                }
                catch (e) {
                    // 旧 FileManager 关闭失败（如残留缓冲）时提示，避免数据静默丢失
                    console.warn('@chaeco/logger: Failed to close previous FileManager while applying file config changes:', e instanceof Error ? e.message : String(e));
                }
                this.fileManager = new FileManager(options.file, options.async);
            }
            else {
                // child logger 共享父级 FileManager，文件配置变更不生效
                console.warn('@chaeco/logger: updateConfig file options ignored for child logger (shares parent FileManager)');
            }
        }
        if (options.format)
            this.configureFormat(options.format);
        if (options.errorHandling)
            this.configureErrorHandling(options.errorHandling);
    }
    // ─── 事件 ────────────────────────────────────────────────
    on(type, handler) {
        if (!this.eventHandlers.has(type))
            this.eventHandlers.set(type, []);
        this.eventHandlers.get(type).push(handler);
    }
    off(type, handler) {
        const handlers = this.eventHandlers.get(type);
        if (!handlers)
            return;
        const i = handlers.indexOf(handler);
        if (i > -1)
            handlers.splice(i, 1);
    }
    // ─── 子 Logger ───────────────────────────────────────────
    child(name) {
        const { consoleColors, consoleTimestamp, format } = this.formatter.settings;
        const opts = {
            level: this.level,
            name: this.name ? `${this.name}:${name}` : name,
            console: { enabled: this.consoleEnabled, colors: consoleColors, timestamp: consoleTimestamp },
            format: { ...format },
            errorHandling: { ...this.errorHandling },
        };
        if (this.fileManager) {
            const fmOpts = this.fileManager.getOptions();
            // 注意：child logger 与父级共享同一个 FileManager（见下方 new Logger(opts, this.fileManager)），
            // 这里的 file 配置仅用于让子级携带配置信息，实际写入路径/轮转/压缩均由共享的父级 FileManager 决定。
            opts.file = {
                enabled: true,
                path: fmOpts.path,
                maxSize: fmOpts.maxSize,
                maxFiles: fmOpts.maxFiles,
                filename: fmOpts.filename,
                maxAge: fmOpts.maxAge,
                compress: fmOpts.compress,
                retryCount: fmOpts.retryCount,
                retryDelay: fmOpts.retryDelay,
            };
            opts.async = this.fileManager.getAsyncOptions();
        }
        else {
            opts.file = { enabled: false };
        }
        return new Logger(opts, this.fileManager);
    }
    // ─── 生命周期 ────────────────────────────────────────────
    async close() {
        if (this.fileManager && this.ownsFileManager) {
            try {
                await this.fileManager.close();
            }
            catch (e) {
                console.error('Error closing FileManager:', e);
            }
        }
    }
    // ─── 内部实现 ────────────────────────────────────────────
    shouldLog(level) {
        return this.levelPriority[level] >= this.levelPriority[this.level];
    }
    emitEvent(type, message, error, data) {
        const handlers = this.eventHandlers.get(type);
        if (!handlers?.length)
            return;
        const event = {
            type,
            message,
            error,
            data,
            timestamp: formatNow('YYYY-MM-DD HH:mm:ss.SSS'),
        };
        for (const h of handlers) {
            try {
                h(event);
            }
            catch (e) {
                console.error('Error in logger event handler:', e);
            }
        }
    }
    createLogEntry(level, message, data) {
        const needCallerInfo = this.formatter.settings.format.includeStack;
        const { file, line } = needCallerInfo
            ? this.callerInfoHelper.getCallerInfo()
            : { file: undefined, line: undefined };
        const entry = {
            level,
            message,
            timestamp: formatNow('YYYY-MM-DD HH:mm:ss.SSS'),
            data,
        };
        if (this.name)
            entry.name = this.name;
        if (file)
            entry.file = file;
        if (line)
            entry.line = line;
        return entry;
    }
    writeToConsole(entry) {
        if (!this.consoleEnabled)
            return;
        const msg = this.formatter.formatConsoleMessage(entry);
        if (entry.level === 'error') {
            console.error(msg);
        }
        else if (entry.level === 'warn') {
            console.warn(msg);
        }
        else {
            console.log(msg);
        }
    }
    writeToFile(entry) {
        if (!this.fileManager || !this.fileEnabled)
            return;
        const msg = this.formatter.formatMessage(entry);
        this.fileManager.write(msg).catch((e) => this.handleWriteError(e, msg, entry));
    }
    handleWriteError(error, message, entry) {
        const err = error instanceof Error ? error : new Error(String(error));
        try {
            this.errorHandling.onError?.(err, 'file_write');
        }
        catch (e) {
            console.error('Error in error handler:', e);
        }
        const preview = message.length > 120 ? message.slice(0, 120) + '…' : message;
        this.emitEvent('fileWriteError', `文件写入失败: ${preview}`, err);
        this.emitEvent('error', '内部错误: file_write', err, { context: 'file_write' });
        if (this.errorHandling.fallbackToConsole && !this.errorHandling.silent)
            console.error('[Logger Fallback]', this.formatter.formatConsoleMessage(entry));
    }
    log(level, ...args) {
        if (!this.shouldLog(level))
            return;
        let message;
        let data;
        if (args.length === 0) {
            message = '';
            data = undefined;
        }
        else if (typeof args[0] === 'string') {
            message = args[0];
            data = args.length === 2 ? args[1] : args.length > 2 ? args.slice(1) : undefined;
        }
        else if (args[0] instanceof Error) {
            message = args[0].message || String(args[0]);
            const errPayload = { message: args[0].message, name: args[0].name };
            if (args[0].stack)
                errPayload.stack = args[0].stack;
            data =
                args.length > 1
                    ? { error: errPayload, additionalData: args.slice(1) }
                    : { error: errPayload };
        }
        else {
            message = '';
            data = args.length === 1 ? args[0] : args;
        }
        const entry = this.createLogEntry(level, message, data);
        this.writeToConsole(entry);
        this.writeToFile(entry);
    }
}

/**
 * @chaeco/logger - 功能完整的日志模块
 *
 * @remarks
 * 仅支持 Node.js 运行时，提供多级别日志、彩色控制台输出、文件写入和错误事件处理等功能。
 *
 * @packageDocumentation
 */
/**
 * 默认 Logger 实例（name: 'app'，level: 'info'，写入 ./logs）
 */
const logger = new Logger({
    name: 'app',
    file: { enabled: true, path: './logs', maxSize: 10 * 1024 * 1024, maxFiles: 30 },
    console: { enabled: true, colors: true, timestamp: true },
});

exports.Logger = Logger;
exports.logger = logger;
//# sourceMappingURL=index.js.map
