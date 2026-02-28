/**
 * 调用栈解析工具
 * @internal
 * 负责从 Error 堆栈中提取调用日志方法的文件路径和行号，并带 LRU 缓存。
 */
export declare class CallerInfoHelper {
    private readonly cache;
    private readonly maxCacheSize;
    constructor(maxCacheSize?: number);
    /**
     * 获取当前调用者的文件路径和行号
     */
    getCallerInfo(): {
        file?: string;
        line?: number;
    };
    /** 清除缓存 */
    clearCache(): void;
    /** 获取缓存大小（调试用） */
    getCacheSize(): number;
    /**
     * 53 位非加密哈希（双 32 位混合），碰撞概率约为 32 位哈希的 1/20亿。
     * 参考：https://stackoverflow.com/a/52171480
     */
    private simpleHash;
    /** LRU 缓存写入：满时淘汰最旧项 */
    private cacheResult;
}
//# sourceMappingURL=caller-info.d.ts.map