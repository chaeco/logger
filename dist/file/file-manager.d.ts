import { FileOptions, AsyncWriteOptions } from '../core/types';
/**
 * 文件管理器 - 管理 Node.js 环境下的日志文件写入。
 * 浏览器环境不使用此类（浏览器仅输出到控制台）。
 * @internal
 */
export declare class FileManager {
    private isInitialized;
    private initError?;
    private nodeWriter?;
    private asyncQueue?;
    private readonly options;
    private readonly asyncOptions?;
    constructor(options?: FileOptions, asyncOptions?: AsyncWriteOptions);
    /** 提前初始化（可选，首次写入时也会自动初始化） */
    init(): void;
    write(message: string): Promise<void>;
    /** 获取当前文件配置（只读），供 child logger 复制时使用，避免外部以 as any 访问私有字段 */
    getOptions(): Readonly<Required<FileOptions>>;
    /** 获取异步写入配置（只读），供 child logger 继承异步策略 */
    getAsyncOptions(): Readonly<AsyncWriteOptions> | undefined;
    /** 关闭存储，刷新剩余队列 */
    close(): Promise<void>;
    /** 获取异步队列状态 */
    getQueueStatus(): {
        size: number;
        isWriting: boolean;
    };
}
//# sourceMappingURL=file-manager.d.ts.map