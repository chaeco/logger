type ColorFn = (text: string) => string

const ansi = (code: number): ColorFn => (text: string) => `\x1b[${code}m${text}\x1b[0m`

const GRAY = ansi(90)
const BLUE = ansi(34)
const YELLOW = ansi(33)
const RED = ansi(31)
const WHITE = ansi(37)
const CYAN = ansi(36)

/**
 * 颜色工具类
 * @internal
 * @remarks
 * 用于处理控制台输出的颜色。为不同级别的日志提供不同的颜色显示。
 */
export class ColorUtils {
  static getLevelColor(level: string): ColorFn {
    switch (level.toLowerCase()) {
      case 'debug': return GRAY
      case 'info': return BLUE
      case 'warn': return YELLOW
      case 'error': return RED
      default: return WHITE
    }
  }

  static colorizeLevel(level: string): string {
    const color = this.getLevelColor(level)
    return color(level.toUpperCase().padEnd(6))
  }

  /**
   * 将时间戳渲染为灰色，内部添加方括号（与 colorizeName / colorizeFileLocation 约定一致）
   */
  static colorizeTimestamp(timestamp: string): string {
    return GRAY(`[${timestamp}]`)
  }

  static colorizeName(name: string): string {
    return CYAN(`[${name}]`)
  }

  static colorizeFileLocation(location: string): string {
    return GRAY(`(${location})`)
  }

  static colorizeMessage(level: string, message: string): string {
    const color = this.getLevelColor(level)
    return color(message)
  }
}
