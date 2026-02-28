import { FileOptions, AsyncWriteOptions } from '../core/types'
import { isNodeEnvironment } from '../utils/environment'
import { NodeWriter } from './node-writer'
import { AsyncQueue } from './async-queue'

/**
 * 文件管理器 - 管理 Node.js 环境下的日志文件写入。
 * 浏览器环境不使用此类（浏览器仅输出到控制台）。
 * @internal
 */
export class FileManager {
  private isInitialized = false
  private initError?: Error
  private nodeWriter?: NodeWriter
  private asyncQueue?: AsyncQueue
  private readonly options: Required<FileOptions>
  private readonly asyncOptions?: AsyncWriteOptions

  constructor(options: FileOptions = {}, asyncOptions?: AsyncWriteOptions) {
    this.asyncOptions = asyncOptions
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
    }

    if (isNodeEnvironment) {
      this.nodeWriter = new NodeWriter(this.options)
      if (asyncOptions?.enabled) {
        const ao: Required<AsyncWriteOptions> = {
          enabled: asyncOptions.enabled,
          queueSize: asyncOptions.queueSize ?? 1000,
          batchSize: asyncOptions.batchSize ?? 100,
          flushInterval: asyncOptions.flushInterval ?? 1000,
          overflowStrategy: asyncOptions.overflowStrategy ?? 'drop',
        }
        this.asyncQueue = new AsyncQueue(ao, msgs => this.nodeWriter!.writeBatch(msgs))
        this.asyncQueue.start()
      }
    }
  }

  /** 提前初始化（可选，首次写入时也会自动初始化） */
  public init(): void {
    if (this.isInitialized || !isNodeEnvironment || !this.nodeWriter) return
    try {
      this.nodeWriter.init()
      if (this.nodeWriter.initError) this.initError = this.nodeWriter.initError
      else this.isInitialized = true
    } catch (e) {
      this.initError = e instanceof Error ? e : new Error(String(e))
      console.warn('@chaeco/logger: Failed to initialize FileManager:', e)
    }
  }

  async write(message: string): Promise<void> {
    if (!this.options.enabled) return
    // 浏览器不写文件（仅控制台输出），防止 nodeWriter 为 undefined 导致空指针崩溃
    if (!isNodeEnvironment) return
    if (!this.isInitialized && !this.initError) this.init()
    if (this.initError) return
    if (this.asyncQueue) { await this.asyncQueue.enqueue(message); return }
    await this.nodeWriter!.write(message)
  }

  /** 获取当前文件配置（只读），供 child logger 复制时使用，避免外部以 as any 访问私有字段 */
  getOptions(): Readonly<Required<FileOptions>> {
    return this.options
  }

  /** 获取异步写入配置（只读），供 child logger 继承异步策略 */
  getAsyncOptions(): Readonly<AsyncWriteOptions> | undefined {
    return this.asyncOptions
  }

  /** 关闭存储，刷新剩余队列 */
  async close(): Promise<void> {
    await this.asyncQueue?.stop()
  }

  /** 获取异步队列状态 */
  getQueueStatus(): { size: number; isWriting: boolean } {
    return { size: this.asyncQueue?.size ?? 0, isWriting: this.asyncQueue?.writing ?? false }
  }
}

