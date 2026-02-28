"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CallerInfoHelper = void 0;
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
        // 尝试从缓存获取（使用堆栈的哈希作为键）
        const stackHash = this.simpleHash(stack);
        if (this.cache.has(stackHash)) {
            // Map.has() 已确认键存在，get() 不会返回 undefined
            return this.cache.get(stackHash);
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
            // 跳过所有 logger 内部帧，包括：
            //   CallerInfoHelper.getCallerInfo  → 当前函数
            //   Logger.createLogEntry           → 内部调用 getCallerInfo 的方法
            //   Logger.log / .debug / .info …  → 公开日志方法
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
                    !filePath.includes('/plugins/logger/') &&
                    !filePath.includes('\\plugins\\logger\\') &&
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
                    this.cacheResult(stackHash, result);
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
    // ─── 私有方法 ─────────────────────────────────────────────
    /**
     * 53 位非加密哈希（双 32 位混合），碰撞概率约为 32 位哈希的 1/20亿。
     * 参考：https://stackoverflow.com/a/52171480
     */
    simpleHash(str) {
        let h1 = 0xdeadbeef;
        let h2 = 0x41c6ce57;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            h1 = Math.imul(h1 ^ char, 2654435761);
            h2 = Math.imul(h2 ^ char, 1597334677);
        }
        h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
        h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
        const hash = 4294967296 * (2097151 & h2) + (h1 >>> 0);
        return hash.toString(36);
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
exports.CallerInfoHelper = CallerInfoHelper;
//# sourceMappingURL=caller-info.js.map