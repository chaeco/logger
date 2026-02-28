"use strict";
/* eslint-disable @typescript-eslint/no-explicit-any */
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
            return this.cache.get(stackHash) || {};
        }
        // 解析堆栈信息
        const stackLines = stack.split('\n');
        let skipCount = 0;
        for (let i = 0; i < stackLines.length; i++) {
            const line = stackLines[i]?.trim();
            if (!line)
                continue;
            // 跳过 Error 本身的行
            if (line.startsWith('Error'))
                continue;
            // 跳过 logger 内部的方法调用
            if (line.includes('Logger.log') ||
                line.includes('Logger.info') ||
                line.includes('Logger.warn') ||
                line.includes('Logger.error') ||
                line.includes('Logger.debug') ||
                line.includes('getCallerInfo') ||
                line.includes('CallerInfoHelper')) {
                skipCount++;
                continue;
            }
            // 跳过前几个内部调用
            if (skipCount < 2) {
                skipCount++;
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
    simpleHash(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转为 32 位整数
        }
        return Math.abs(hash).toString(36);
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