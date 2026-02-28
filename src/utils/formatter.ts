/* eslint-disable @typescript-eslint/no-explicit-any */

import { LogEntry, FormatOptions } from '../core/types'
import { ColorUtils } from './color-utils'
import dayjs from 'dayjs'

/**
 * 格式化器运行时配置
 */
export interface FormatterSettings {
  consoleTimestamp: boolean
  consoleColors: boolean
  format: {
    enabled: boolean
    timestampFormat: string
    formatter?: (entry: LogEntry) => string
    includeStack: boolean
    includeName: boolean
    json: boolean
    jsonIndent: number
  }
}

/**
 * 日志格式化器
 * @internal
 * 负责将 LogEntry 转换为可输出的字符串，支持普通文本、彩色控制台和 JSON 格式。
 */
export class LogFormatter {
  settings: FormatterSettings

  constructor(settings: FormatterSettings) {
    this.settings = settings
  }

  /**
   * 更新格式化选项（支持部分更新）
   */
  updateFormat(options: Partial<FormatOptions>): void {
    const f = this.settings.format
    if (options.enabled !== undefined) f.enabled = options.enabled
    if (options.timestampFormat !== undefined) f.timestampFormat = options.timestampFormat
    if (options.formatter !== undefined) f.formatter = options.formatter
    if (options.includeStack !== undefined) f.includeStack = options.includeStack
    if (options.includeName !== undefined) f.includeName = options.includeName
    if (options.json !== undefined) f.json = options.json
    if (options.jsonIndent !== undefined) f.jsonIndent = options.jsonIndent
  }

  // ─── 公开格式化方法 ───────────────────────────────────────

  /**
   * 格式化为文件输出字符串。
   * 注意：文件日志始终包含时间戳，与控制台的 consoleTimestamp 开关无关。
   */
  formatMessage(entry: LogEntry): string {
    const { format } = this.settings

    // 自定义格式化函数
    if (format.enabled && format.formatter) {
      try {
        return format.formatter(entry)
      } catch (error) {
        console.error('Error in custom formatter:', error)
        // 降级到默认格式
      }
    }

    // JSON 格式输出
    if (format.json) {
      const jsonEntry: Record<string, unknown> = {
        timestamp: entry.timestamp,
        level: entry.level,
        message: entry.message,
      }
      if (format.includeName && entry.name) jsonEntry.name = entry.name
      if (format.includeStack && entry.file && entry.line) {
        jsonEntry.file = entry.file
        jsonEntry.line = entry.line
      }
      if (entry.data !== undefined) jsonEntry.data = entry.data
      return this.safeStringify(jsonEntry, format.jsonIndent)
    }

    // 默认格式：文件日志始终包含时间戳
    return this.buildPlainText(entry, true)
  }

  /**
   * 格式化为带 ANSI 颜色的控制台字符串。
   * 无色模式下使用纯文本，且遵守 consoleTimestamp 开关（与文件格式独立）。
   * 自定义 formatter 函数的优先级高于颜色开关。
   */
  formatConsoleMessage(entry: LogEntry): string {
    const { consoleColors, consoleTimestamp, format } = this.settings

    // 自定义格式化函数优先——无论是否启用颜色，均走自定义逻辑
    if (format.enabled && format.formatter) {
      try {
        return format.formatter(entry)
      } catch (error) {
        console.error('Error in custom formatter:', error)
        // 降级到默认格式
      }
    }

    if (!consoleColors) {
      // 无色模式：纯文本，遵守 consoleTimestamp 开关。
      // 不能调用 formatMessage()，因为文件格式始终包含时间戳，两者策略不同。
      return this.buildPlainText(entry, consoleTimestamp)
    }

    const parts: string[] = []

    if (consoleTimestamp) {
      parts.push(ColorUtils.colorizeTimestamp(`[${entry.timestamp}]`))
    }

    if (entry.name) parts.push(ColorUtils.colorizeName(entry.name))

    parts.push(ColorUtils.colorizeLevel(entry.level))

    if (entry.file && entry.line) {
      parts.push(ColorUtils.colorizeFileLocation(`${entry.file}:${entry.line}`))
    }

    parts.push(ColorUtils.colorizeMessage(entry.level, entry.message))

    if (entry.data !== undefined) parts.push(this.safeStringify(entry.data))

    return parts.join(' ')
  }

  // ─── 私有辅助 ───────────────────────────────────────────────

  /**
   * 构建纯文本日志行，供文件输出和无色控制台复用。
   * @param includeTimestamp 是否包含时间戳（文件格式始终传 true；控制台按 consoleTimestamp 传入）
   */
  private buildPlainText(entry: LogEntry, includeTimestamp: boolean): string {
    const { format } = this.settings
    const parts: string[] = []

    if (includeTimestamp) {
      const ts = dayjs(entry.timestamp).format(format.timestampFormat)
      parts.push(`[${ts}]`)
    }

    if (format.includeName && entry.name) parts.push(`[${entry.name}]`)

    parts.push(entry.level.toUpperCase().padEnd(6))

    if (format.includeStack && entry.file && entry.line) {
      parts.push(`(${entry.file}:${entry.line})`)
    }

    parts.push(entry.message)

    if (entry.data !== undefined) parts.push(this.safeStringify(entry.data))

    return parts.join(' ')
  }

  /**
   * 安全的 JSON 序列化，处理循环引用
   */
  private safeStringify(obj: any, indent?: number): string {
    try {
      const seen = new WeakSet()
      return JSON.stringify(
        obj,
        (_key: string, value: any) => {
          if (typeof value === 'object' && value !== null) {
            if (seen.has(value)) return '[Circular]'
            seen.add(value)
          }
          return value
        },
        indent,
      )
    } catch {
      try {
        return String(obj)
      } catch {
        return '[Unable to serialize]'
      }
    }
  }
}
