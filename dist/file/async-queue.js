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
    }
    /** 将消息加入队列 */
    async enqueue(message) {
        if (this.queue.length >= this.options.queueSize) {
            switch (this.options.overflowStrategy) {
                case 'drop': return;
                case 'block':
                case 'overflow':
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
    /** 停止定时器并刷新剩余队列 */
    async stop() {
        if (this.flushTimer) {
            clearInterval(this.flushTimer);
            this.flushTimer = undefined;
        }
        if (this.queue.length > 0)
            await this.flush();
    }
}
exports.AsyncQueue = AsyncQueue;
//# sourceMappingURL=async-queue.js.map