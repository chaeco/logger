import chalk from 'chalk'

/**
 * 颜色工具类
 * @internal
 * @remarks
 * 用于处理控制台输出的颜色。为不同级别的日志提供不同的颜色显示。
 */
export class ColorUtils {
  static getLevelColor(level: string): typeof chalk {
    switch (level.toLowerCase()) {
      case 'debug':
        return chalk.gray
      case 'info':
        return chalk.blue
      case 'warn':
        return chalk.yellow
      case 'error':
        return chalk.red
      default:
        return chalk.white
    }
  }

  static colorizeLevel(level: string): string {
    const color = this.getLevelColor(level)
    return color(level.toUpperCase().padEnd(6))
  }

  static colorizeTimestamp(timestamp: string): string {
    return chalk.gray(timestamp)
  }

  static colorizeName(name: string): string {
    return chalk.cyan(`[${name}]`)
  }

  static colorizeFileLocation(location: string): string {
    return chalk.gray(`(${location})`)
  }

  static colorizeMessage(level: string, message: string): string {
    const color = this.getLevelColor(level)
    return color(message)
  }
}
