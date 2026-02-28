/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  LogLevel, LoggerOptions, LogEntry,
  LoggerEventType, LoggerEventHandler, LoggerEvent,
} from './types'
import { LoggerBase } from './logger-base'
import { FileManager } from '../file/file-manager'
import { isNodeEnvironment } from '../utils/environment'
import { CallerInfoHelper } from '../utils/caller-info'
import { LogFormatter } from '../utils/formatter'
import dayjs from 'dayjs'

export class Logger extends LoggerBase {
  protected level: LogLevel
  private name?: string
  protected fileManager: FileManager | undefined
  protected consoleEnabled: boolean

  // isNodeEnvironment / isBrowserEnvironment 均为模块级常量，无需复制为实例字段
  private readonly callerInfoHelper = new CallerInfoHelper()
  protected formatter: LogFormatter

  private eventHandlers: Map<LoggerEventType, LoggerEventHandler[]> = new Map()

  constructor(options: LoggerOptions = {}) {
    super()
    this.level = options.level ?? 'info'
    this.name = options.name

    if (isNodeEnvironment && options.file?.enabled !== false) {
      this.fileManager = new FileManager(options.file, options.async)
    }

    this.consoleEnabled = options.console?.enabled ?? true

    this.formatter = new LogFormatter({
      consoleColors: options.console?.colors ?? isNodeEnvironment,
      consoleTimestamp: options.console?.timestamp ?? true,
      format: {
        enabled: options.format?.enabled ?? false,
        timestampFormat: options.format?.timestampFormat ?? 'YYYY-MM-DD HH:mm:ss.SSS',
        formatter: options.format?.formatter,
        includeStack: options.format?.includeStack ?? true,
        includeName: options.format?.includeName ?? true,
        json: options.format?.json ?? false,
        jsonIndent: options.format?.jsonIndent ?? 0,
      },
    })

    if (options.sampling) this.configureSampling(options.sampling)
    if (options.rateLimit) this.configureRateLimit(options.rateLimit)
    if (options.filter) this.configureFilter(options.filter)
    if (options.errorHandling) this.configureErrorHandling(options.errorHandling)
  }

  protected emitLevelChange(newLevel: LogLevel, oldLevel: LogLevel): void {
    this.emitEvent('levelChange', `日志等级已从 ${oldLevel} 更改为 ${newLevel}`, undefined, { oldLevel, newLevel })
  }

  // ─── 限流状态 ─────────────────────────────────────────────
  /** 当前窗口是否已发出过限流事件（避免每条被限流的日志都触发一次事件洪泛） */
  private rlEventEmittedInWindow = false

  // ─── 初始化 ──────────────────────────────────────────────

  init(): void { this.fileManager?.init() }

  // ─── 核心日志方法 ─────────────────────────────────────────

  debug(...args: any[]): void { this.log('debug', ...args) }
  info(...args: any[]): void { this.log('info', ...args) }
  warn(...args: any[]): void { this.log('warn', ...args) }
  error(...args: any[]): void { this.log('error', ...args) }

  // ─── 等级控制 ─────────────────────────────────────────────

  setLevel(level: LogLevel): void {
    const old = this.level
    this.level = level
    this.emitLevelChange(level, old)
  }

  getLevel(): LogLevel { return this.level }

  // ─── 事件 ────────────────────────────────────────────────

  on(type: LoggerEventType, handler: LoggerEventHandler): void {
    if (!this.eventHandlers.has(type)) this.eventHandlers.set(type, [])
    this.eventHandlers.get(type)!.push(handler)
  }

  off(type: LoggerEventType, handler: LoggerEventHandler): void {
    const handlers = this.eventHandlers.get(type)
    if (!handlers) return
    const i = handlers.indexOf(handler)
    if (i > -1) handlers.splice(i, 1)
  }

  // ─── 子 Logger ───────────────────────────────────────────

  child(name: string): Logger {
    const { consoleColors, consoleTimestamp, format } = this.formatter.settings
    const opts: LoggerOptions = {
      level: this.level,
      name: this.name ? `${this.name}:${name}` : name,
      console: { enabled: this.consoleEnabled, colors: consoleColors, timestamp: consoleTimestamp },
      sampling: { ...this.sampling },
      rateLimit: { ...this.rateLimit },
      filter: { enabled: this.filter.enabled, filters: [...this.filter.filters], mode: this.filter.mode },
      format: { ...format },
      errorHandling: { ...this.errorHandling },
    }
    if (this.fileManager) {
      // 通过公开的 getOptions()/getAsyncOptions() 读取配置，避免以 as any 访问私有字段；
      // 完整复制所有文件选项和异步策略，确保子 logger 行为与父实例完全一致
      const fmOpts = this.fileManager.getOptions()
      opts.file = {
        enabled: true,
        path: fmOpts.path,
        maxSize: fmOpts.maxSize,
        maxFiles: fmOpts.maxFiles,
        filename: fmOpts.filename,
        maxAge: fmOpts.maxAge,
        compress: fmOpts.compress,
        retryCount: fmOpts.retryCount,
        retryDelay: fmOpts.retryDelay,
      }
      opts.async = this.fileManager.getAsyncOptions()
    }
    return new Logger(opts)
  }

  // ─── 生命周期 ────────────────────────────────────────────

  async close(): Promise<void> {
    if (this.fileManager) {
      try { await this.fileManager.close() } catch (e) { console.error('Error closing FileManager:', e) }
    }
  }

  // ─── 内部实现 ────────────────────────────────────────────

  private shouldLog(level: LogLevel): boolean {
    return this.levelPriority[level] >= this.levelPriority[this.level]
  }

  private shouldSample(level: LogLevel): boolean {
    if (!this.sampling.enabled) return true
    return Math.random() < (this.sampling.rateByLevel[level] ?? this.sampling.rate)
  }

  private checkRateLimit(): boolean {
    if (!this.rateLimit.enabled) return true
    const now = Date.now()
    if (now - this.rlWindowStart >= this.rateLimit.windowSize) {
      this.rlWindowStart = now; this.rlWindowCount = 0; this.rlEventEmittedInWindow = false
    }
    if (this.rlWindowCount >= this.rateLimit.maxLogsPerWindow) {
      if (this.rateLimit.warnOnLimitExceeded && !this.rlEventEmittedInWindow) {
        this.rlEventEmittedInWindow = true
        this.emitEvent('rateLimitExceeded',
          `日志限流已触发: ${this.rlWindowCount}/${this.rateLimit.maxLogsPerWindow} 日志在 ${this.rateLimit.windowSize}ms 内`)
      }
      return false
    }
    this.rlWindowCount++
    return true
  }

  private shouldPassFilter(entry: LogEntry): boolean {
    if (!this.filter.enabled || !this.filter.filters.length) return true
    const results = this.filter.filters.map(f => { try { return f(entry) } catch { return true } })
    return this.filter.mode === 'all' ? results.every(Boolean) : results.some(Boolean)
  }

  private emitEvent(type: LoggerEventType, message: string, error?: Error, data?: unknown): void {
    const handlers = this.eventHandlers.get(type)
    if (!handlers?.length) return
    const event: LoggerEvent = { type, message, error, data, timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS') }
    for (const h of handlers) { try { h(event) } catch (e) { console.error('Error in logger event handler:', e) } }
  }

  private createLogEntry(level: LogLevel, message: string, data?: unknown): LogEntry {
    const { file, line } = this.callerInfoHelper.getCallerInfo()
    const entry: LogEntry = {
      level,
      message,  // 调用方已保证 message 为 string，无需再次 safeStringify
      timestamp: dayjs().format('YYYY-MM-DD HH:mm:ss.SSS'),
      data,
    }
    if (this.name) entry.name = this.name
    if (file) entry.file = file
    if (line) entry.line = line
    return entry
  }

  private writeToConsole(entry: LogEntry): void {
    if (!this.consoleEnabled) return
    const msg = this.formatter.formatConsoleMessage(entry)
    const consoleFn = entry.level === 'error' ? console.error : console.log
    consoleFn(msg)
  }

  private writeToFile(entry: LogEntry): void {
    if (!this.fileManager) return
    const msg = this.formatter.formatMessage(entry)
    // FileManager.write() 始终返回 Promise<void>，直接链式处理错误即可，无需 instanceof 判断
    this.fileManager.write(msg).catch(e => this.handleWriteError(e, msg, entry))
    this.metrics.fileWrites++
  }

  private handleWriteError(error: unknown, message: string, entry?: LogEntry): void {
    this.metrics.fileWriteErrors++
    const err = error instanceof Error ? error : new Error(String(error))
    try { this.errorHandling.onError?.(err, 'file_write') } catch (e) { console.error('Error in error handler:', e) }
    // 事件 message 仅包含简短摘要，避免嵌入完整日志文本（大对象序列化可能非常长）
    const preview = message.length > 120 ? message.slice(0, 120) + '…' : message
    this.emitEvent('fileWriteError', `文件写入失败: ${preview}`, err)
    // fallbackToConsole 决定是否将失败的日志条目降级输出到 console（默认 true）。
    // silent:true（默认）完全静默，抑制所有 stderr 输出；两者皆允许时才打印。
    // 注意：不能 throw——调用链来自 .catch()，否则产生 UnhandledPromiseRejection。
    if (this.errorHandling.fallbackToConsole && !this.errorHandling.silent && entry)
      console.error('[Logger Fallback]', this.formatter.formatConsoleMessage(entry))
  }

  private log(level: LogLevel, ...args: any[]): void {
    if (!this.shouldLog(level)) return
    let message: string, data: unknown
    if (args.length === 0) {
      message = ''; data = undefined
    } else if (typeof args[0] === 'string') {
      message = args[0]
      data = args.length === 2 ? args[1] : args.length > 2 ? args.slice(1) : undefined
    } else if (args[0] instanceof Error) {
      message = args[0].message || String(args[0])
      // 单独传入 Error 时也保留 error 对象（含 stack 堆栈信息）；有额外参数时合并到对象中
      data = args.length > 1 ? { error: args[0], additionalData: args.slice(1) } : args[0]
    } else {
      message = ''; data = args.length === 1 ? args[0] : args
    }

    const start = performance.now()
    this.metrics.totalLogs++
    if (!this.shouldSample(level)) { this.metrics.sampledLogs++; this.metrics.droppedLogs++; return }
    if (!this.checkRateLimit()) { this.metrics.droppedLogs++; return }

    const entry = this.createLogEntry(level, message, data)
    if (this.filter.enabled && !this.shouldPassFilter(entry)) { this.metrics.filteredLogs++; this.metrics.droppedLogs++; return }

    this.writeToConsole(entry)
    this.writeToFile(entry)

    this.metricsN++
    this.metrics.avgProcessingTime += (performance.now() - start - this.metrics.avgProcessingTime) / this.metricsN
  }
}
