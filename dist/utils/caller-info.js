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
exports.CallerInfoHelper = CallerInfoHelper;
//# sourceMappingURL=caller-info.js.map