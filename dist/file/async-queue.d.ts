import { AsyncWriteOptions } from '../core/types';
/**
 * 异步写入队列 - 批量缓冲日志消息，按批次大小或定时间隔写入。
 * @internal
 */
export declare class AsyncQueue {
    private queue;
    private isWriting;
    private flushTimer?;
    private readonly options;
    private readonly onFlush;
    constructor(options: Required<AsyncWriteOptions>, onFlush: (messages: string[]) => Promise<void>);
    get size(): number;
    get writing(): boolean;
    /** 启动定时刷新器 */
    start(): void;
    /** 将消息加入队列 */
    enqueue(message: string): Promise<void>;
    /** 立即刷新队列 */
    flush(): Promise<void>;
    /** 停止定时器并刷新剩余队列 */
    stop(): Promise<void>;
}
//# sourceMappingURL=async-queue.d.ts.map