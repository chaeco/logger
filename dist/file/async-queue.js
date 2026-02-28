"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AsyncQueue = void 0;
/**
 * 异步写入队列 - 批量缓冲日志消息，按批次大小或定时间隔写入。
 * @internal
 */
class AsyncQueue {
    constructor(options, onFlush) {
        this.queue = [];
        this.isWriting = false;
        this.options = options;
        this.onFlush = onFlush;
    }
    get size() { return this.queue.length; }
    get writing() { return this.isWriting; }
    /** 启动定时刷新器 */
    start() {
        if (this.flushTimer)
            return;
        this.flushTimer = setInterval(() => {
            if (this.queue.length > 0) {
                this.flush().catch(e => console.error('Failed to flush log queue:', e));
            }
        }, this.options.flushInterval);
        // unref 使定时器不阻止进程自然退出（进程中只剩这个定时器时可以退出）
        this.flushTimer.unref?.();
    }
    /** 将消息加入队列 */
    async enqueue(message) {
        // 用 while 而非 if：flush 失败时消息会被退回队列，队列仍可能满，需重新判断。
        // 若一直用 if，flush 失败后依然 push，队列长度将无限突破 queueSize 上界。
        while (this.queue.length >= this.options.queueSize) {
            switch (this.options.overflowStrategy) {
                case 'drop': return;
                case 'block':
                case 'overflow':
                    // 'block' 和 'overflow' 均在此处先刷写一批再继续入队。
                    // 注意：'overflow' 字面含义为"溢出到新队列"，当前实现与 'block' 等效——
                    // 都是等待当前批次写完后继续。如需真正独立溢出队列，需扩展此处逻辑。
                    await this.flush();
                    break;
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
        // 循环直到队列彻底清空（每次最多写 batchSize 条）。
        // 若 onFlush 持续失败，flush() 会将消息退回队列，此处设置最大重试轮次防止死循环。
        // FLUSH_SAFETY_BUFFER 额外轮次：防止 onFlush 间歇性失败时循环提前终止。
        const FLUSH_SAFETY_BUFFER = 3;
        const maxAttempts = Math.ceil(this.queue.length / this.options.batchSize) + FLUSH_SAFETY_BUFFER;
        let attempts = 0;
        while (this.queue.length > 0 && attempts < maxAttempts) {
            if (this.isWriting) {
                // 如果当前正在进行 flush（可能来自 setInterval），等待一小段时间再重试
                await new Promise(r => setTimeout(r, 10));
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
exports.AsyncQueue = AsyncQueue;
//# sourceMappingURL=async-queue.js.map