import * as fs from 'fs'
import * as path from 'path'
import * as zlib from 'zlib'
import { promisify } from 'util'
import dayjs from 'dayjs'
import { FileOptions, AsyncWriteOptions } from './types'
import { isNodeEnvironment, isBrowserEnvironment } from './environment'
import { IndexedDBStorage } from '@chaeco/indexed-db-storage'

const gzip = promisify(zlib.gzip)
const readFile = promisify(fs.readFile)
const writeFile = promisify(fs.writeFile)
const unlink = promisify(fs.unlink)

/**
 * 文件管理器类
 * @internal
 * @remarks
 * 负责管理日志文件的创建、写入、轮转和清理。
 * - Node.js 环境：使用文件系统写入
 * - 浏览器环境：使用 IndexedDB 存储（@chaeco/indexed-db-storage）
 * 
 * 支持按日期分割和大文件自动分割。
 */
export class FileManager {
  private options: Required<FileOptions>
  private currentFilePath: string = ''
  private currentFileSize: number = 0
  private fileIndex: number = 0
  
  // 浏览器环境使用
  private indexedDBStorage?: IndexedDBStorage
  private isInitialized: boolean = false

  // 异步写入队列
  private asyncOptions?: Required<AsyncWriteOptions>
  private writeQueue: string[] = []
  private flushTimer?: NodeJS.Timeout
  private isWriting: boolean = false

  constructor(options: FileOptions = {}, asyncOptions?: AsyncWriteOptions) {
    this.options = {
      enabled: options.enabled ?? true,
      path: options.path ?? './logs',
      maxSize: options.maxSize ?? '10m',
      maxFiles: options.maxFiles ?? 30,
      filename: options.filename ?? 'app',
      maxAge: options.maxAge ?? 30,
      compress: options.compress ?? false,
      writeMode: options.writeMode ?? 'sync',
      fileMode: options.fileMode ?? 0o644,
      dirMode: options.dirMode ?? 0o755,
    }

    // 初始化异步写入配置
    if (asyncOptions?.enabled && isNodeEnvironment) {
      this.asyncOptions = {
        enabled: asyncOptions.enabled,
        queueSize: asyncOptions.queueSize ?? 1000,
        batchSize: asyncOptions.batchSize ?? 100,
        flushInterval: asyncOptions.flushInterval ?? 1000,
        overflowStrategy: asyncOptions.overflowStrategy ?? 'drop',
      }
      this.startFlushTimer()
    }

    if (isNodeEnvironment) {
      this.ensureLogDirectory()
      this.initializeCurrentFile()
    } else if (isBrowserEnvironment) {
      this.initializeIndexedDB().catch((error) => {
        console.warn('@chaeco/logger: Failed to initialize IndexedDB storage:', error)
      })
    } else {
      console.warn('@chaeco/logger: FileManager 在当前环境中不可用。请在浏览器或 Node.js 中使用。')
    }
  }

  private async initializeIndexedDB(): Promise<void> {
    try {
      this.indexedDBStorage = new IndexedDBStorage({
        dbName: '@chaeco/logger-files',
        storeName: this.options.filename,
        maxRecords: this.options.maxFiles,
        retentionTime: this.options.maxAge * 24 * 60 * 60 * 1000, // 转换为毫秒
        cleanupInterval: 60 * 60 * 1000, // 1 小时
        timestampIndexName: 'timestamp',
      })
      
      await this.indexedDBStorage.init()
      this.isInitialized = true
      if (typeof console !== 'undefined') {
        console.log(`✓ IndexedDB storage initialized for ${this.options.filename}`)
      }
    } catch (error) {
      console.warn('@chaeco/logger: Failed to initialize IndexedDB:', error)
    }
  }

  private ensureLogDirectory(): void {
    if (!fs.existsSync(this.options.path)) {
      fs.mkdirSync(this.options.path, { recursive: true })
    }
  }

  private initializeCurrentFile(): void {
    const today = dayjs().format('YYYY-MM-DD')
    this.currentFilePath = path.join(this.options.path, `${this.options.filename}-${today}.log`)
    this.fileIndex = 0

    // 检查是否需要创建新的文件索引
    while (fs.existsSync(this.getIndexedFilePath())) {
      this.fileIndex++
    }

    if (this.fileIndex > 0) {
      this.currentFilePath = this.getIndexedFilePath()
    }

    // 获取当前文件大小
    if (fs.existsSync(this.currentFilePath)) {
      this.currentFileSize = fs.statSync(this.currentFilePath).size
    }
  }

  private getIndexedFilePath(): string {
    const today = dayjs().format('YYYY-MM-DD')
    const baseName = `${this.options.filename}-${today}`
    return this.fileIndex === 0
      ? path.join(this.options.path, `${baseName}.log`)
      : path.join(this.options.path, `${baseName}.${this.fileIndex}.log`)
  }

  private parseMaxSize(size: string): number {
    const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/)
    if (!match || !match[1]) return 10 * 1024 * 1024 // 默认 10MB

    const value = parseFloat(match[1])
    const unit = match[2]
    if (unit === 'b') return value * 1
    if (unit === 'kb') return value * 1024
    if (unit === 'gb') return value * 1024 * 1024 * 1024
    return value * 1024 * 1024 // 默认 mb
  }

  private shouldRotateFile(): boolean {
    const maxSize = this.parseMaxSize(this.options.maxSize)
    return this.currentFileSize >= maxSize
  }

  private rotateFile(): void {
    this.fileIndex++
    this.currentFilePath = this.getIndexedFilePath()
    this.currentFileSize = 0
    this.cleanupOldFiles()
  }

  private cleanupOldFiles(): void {
    try {
      const files = fs
        .readdirSync(this.options.path)
        .filter(file => file.startsWith(this.options.filename) && (file.endsWith('.log') || file.endsWith('.log.gz')))
        .map(file => ({
          name: file,
          path: path.join(this.options.path, file),
          stats: fs.statSync(path.join(this.options.path, file)),
        }))
        .sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime())

      // 1. 按数量清理：删除超过 maxFiles 数量的文件
      if (files.length > this.options.maxFiles) {
        const filesToDelete = files.slice(this.options.maxFiles)
        filesToDelete.forEach(file => {
          try {
            fs.unlinkSync(file.path)
          } catch (error) {
            // 忽略删除失败的文件
          }
        })
      }

      // 2. 按时间清理：删除超过 maxAge 天数的文件
      const now = Date.now()
      const maxAgeMs = this.options.maxAge * 24 * 60 * 60 * 1000
      
      files.forEach(file => {
        const fileAge = now - file.stats.mtime.getTime()
        if (fileAge > maxAgeMs) {
          try {
            fs.unlinkSync(file.path)
          } catch (error) {
            // 忽略删除失败的文件
          }
        }
      })

      // 3. 压缩旧日志：压缩超过1天的未压缩日志文件
      if (this.options.compress) {
        this.compressOldLogs().catch(_error => {
          // 静默失败，不影响主流程
        })
      }
    } catch (error) {
      // 忽略清理过程中的错误
    }
  }

  /**
   * 压缩旧的日志文件
   * @private
   */
  private async compressOldLogs(): Promise<void> {
    try {
      const files = fs
        .readdirSync(this.options.path)
        .filter(file => file.startsWith(this.options.filename) && file.endsWith('.log') && !file.endsWith('.log.gz'))
        .map(file => ({
          name: file,
          path: path.join(this.options.path, file),
          stats: fs.statSync(path.join(this.options.path, file)),
        }))

      const now = Date.now()
      const oneDayMs = 24 * 60 * 60 * 1000
      const today = dayjs().format('YYYY-MM-DD')

      for (const file of files) {
        // 检查文件是否超过1天且不是今天的文件
        const fileAge = now - file.stats.mtime.getTime()
        const isCurrentFile = file.path === this.currentFilePath
        
        // 从文件名中提取日期
        const dateMatch = file.name.match(/(\d{4}-\d{2}-\d{2})/)
        const fileDate = dateMatch ? dateMatch[1] : null
        
        if (fileAge > oneDayMs && !isCurrentFile && fileDate && fileDate !== today) {
          try {
            // 读取文件内容
            const content = await readFile(file.path)
            // 压缩内容
            const compressed = await gzip(content)
            // 写入压缩文件
            await writeFile(file.path + '.gz', compressed)
            // 删除原文件
            await unlink(file.path)
          } catch (error) {
            // 压缩失败时不删除原文件，静默失败
          }
        }
      }
    } catch (error) {
      // 忽略压缩过程中的错误
    }
  }

  private checkDateRotation(): void {
    const today = dayjs().format('YYYY-MM-DD')
    const currentFileDate = path
      .basename(this.currentFilePath)
      .split('-')
      .slice(1, 4)
      .join('-')
      .split('.')[0]

    if (currentFileDate !== today) {
      this.initializeCurrentFile()
    }
  }

  async write(message: string): Promise<void> {
    if (!this.options.enabled) return

    // 浏览器环境：使用 IndexedDB
    if (isBrowserEnvironment && this.indexedDBStorage && this.isInitialized) {
      try {
        const logEntry = {
          timestamp: Date.now(),
          date: dayjs().format('YYYY-MM-DD'),
          content: message,
          size: Buffer.byteLength(message, 'utf8'),
        }
        await this.indexedDBStorage.save(logEntry)
      } catch (error) {
        console.error('Failed to write log to IndexedDB:', error)
      }
      return
    }

    // Node.js 环境：异步写入模式
    if (this.asyncOptions?.enabled) {
      await this.enqueueMessage(message)
      return
    }

    // Node.js 环境：同步写入模式
    await this.writeToFileWithRetry(message)
  }

  /**
   * 将消息加入异步写入队列
   * @private
   */
  private async enqueueMessage(message: string): Promise<void> {
    if (!this.asyncOptions) return

    // 检查队列是否已满
    if (this.writeQueue.length >= this.asyncOptions.queueSize) {
      switch (this.asyncOptions.overflowStrategy) {
        case 'drop':
          // 丢弃新消息
          return
        case 'block':
          // 阻塞直到队列有空间（等待刷新）
          await this.flushQueue()
          break
        case 'overflow':
          // 立即刷新队列，为新消息腾出空间
          await this.flushQueue()
          break
      }
    }

    this.writeQueue.push(message)

    // 如果队列达到批量大小，立即刷新
    if (this.writeQueue.length >= this.asyncOptions.batchSize) {
      await this.flushQueue()
    }
  }

  /**
   * 启动定时刷新器
   * @private
   */
  private startFlushTimer(): void {
    if (this.flushTimer || !this.asyncOptions) return

    this.flushTimer = setInterval(() => {
      if (this.writeQueue.length > 0) {
        this.flushQueue().catch(error => {
          console.error('Failed to flush log queue:', error)
        })
      }
    }, this.asyncOptions.flushInterval)
  }

  /**
   * 刷新写入队列
   * @private
   */
  private async flushQueue(): Promise<void> {
    if (this.isWriting || this.writeQueue.length === 0) return

    this.isWriting = true
    const messages = this.writeQueue.splice(0, this.asyncOptions?.batchSize ?? 100)

    try {
      this.checkDateRotation()

      // 批量写入
      const content = messages.join('\n') + '\n'
      const contentSize = Buffer.byteLength(content, 'utf8')

      // 检查是否需要轮转
      if (this.shouldRotateFile()) {
        this.rotateFile()
      }

      // 写入文件
      await this.appendToFileWithRetry(content)
      this.currentFileSize += contentSize
    } catch (error) {
      console.error('Failed to flush queue:', error)
      // 将消息放回队列头部
      this.writeQueue.unshift(...messages)
    } finally {
      this.isWriting = false
    }
  }

  /**
   * 带重试机制的文件写入
   * @private
   */
  private async writeToFileWithRetry(message: string, retryCount: number = 3): Promise<void> {
    this.checkDateRotation()

    if (this.shouldRotateFile()) {
      this.rotateFile()
    }

    const content = message + '\n'
    await this.appendToFileWithRetry(content, retryCount)
    this.currentFileSize += Buffer.byteLength(content, 'utf8')
  }

  /**
   * 带重试的追加文件内容
   * @private
   */
  private async appendToFileWithRetry(content: string, retryCount: number = 3): Promise<void> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        if (attempt > 0) {
          // 重试延迟
          await new Promise(resolve => setTimeout(resolve, 100 * attempt))
        }

        fs.appendFileSync(this.currentFilePath, content, {
          mode: this.options.fileMode,
        })
        return // 成功写入
      } catch (error) {
        lastError = error as Error

        if (attempt === 0) {
          // 第一次失败时尝试重新初始化文件
          this.initializeCurrentFile()
        }
      }
    }

    // 所有重试都失败，记录错误
    console.error(`Failed to write log after ${retryCount + 1} attempts:`, lastError)
    throw lastError
  }

  /**
   * 从 IndexedDB 查询存储的日志（仅浏览器环境）
   */
  async queryLogs(options?: { limit?: number; offset?: number; date?: string }): Promise<Record<string, unknown>[]> {
    if (!isBrowserEnvironment || !this.indexedDBStorage || !this.isInitialized) {
      console.warn('queryLogs is only available in browser environment with IndexedDB')
      return []
    }

    try {
      const result = await this.indexedDBStorage.query({
        limit: options?.limit ?? 100,
        offset: options?.offset ?? 0,
      })
      
      // 处理 IndexedDB 查询结果
      let logs: Record<string, unknown>[] = []
      if (Array.isArray(result)) {
        logs = result as Record<string, unknown>[]
      } else if (result && typeof result === 'object' && 'data' in result) {
        const resultObj = result as Record<string, unknown>
        logs = Array.isArray(resultObj.data) ? (resultObj.data as Record<string, unknown>[]) : []
      }
      
      // 如果指定了日期，进行过滤
      if (options?.date) {
        return logs.filter((log: Record<string, unknown>) => log.date === options.date)
      }
      
      return logs
    } catch (error) {
      console.error('Failed to query logs from IndexedDB:', error)
      return []
    }
  }

  /**
   * 清除 IndexedDB 中的所有日志（仅浏览器环境）
   */
  async clearLogs(): Promise<void> {
    if (!isBrowserEnvironment || !this.indexedDBStorage || !this.isInitialized) {
      return
    }

    try {
      await this.indexedDBStorage.clear()
    } catch (error) {
      console.error('Failed to clear logs from IndexedDB:', error)
    }
  }

  /**
   * 关闭存储连接
   */
  async close(): Promise<void> {
    // 停止定时器
    if (this.flushTimer) {
      clearInterval(this.flushTimer)
      this.flushTimer = undefined
    }

    // 刷新剩余队列
    if (this.writeQueue.length > 0) {
      await this.flushQueue()
    }

    // 关闭 IndexedDB
    if (this.indexedDBStorage) {
      this.indexedDBStorage.close()
    }
  }

  /**
   * 获取队列状态
   */
  getQueueStatus(): { size: number; isWriting: boolean } {
    return {
      size: this.writeQueue.length,
      isWriting: this.isWriting,
    }
  }
}
