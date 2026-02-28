/**
 * 自动清理和压缩示例
 * 演示如何使用 maxAge 和 compress 配置来管理日志文件
 */

import { Logger } from '../src/logger'

// 示例 1: 启用自动清理，保留最近 7 天的日志
const loggerWithAutoCleanup = new Logger({
  level: 'info',
  name: 'auto-cleanup',
  file: {
    enabled: true,
    path: './logs',
    maxSize: 10 * 1024 * 1024,
    maxFiles: 50,
    filename: 'app-cleanup',
    maxAge: 7, // 自动删除 7 天前的日志文件
  },
})

// 示例 2: 启用日志压缩，自动压缩超过 1 天的日志
const loggerWithCompression = new Logger({
  level: 'info',
  name: 'compression',
  file: {
    enabled: true,
    path: './logs',
    maxSize: 10 * 1024 * 1024,
    maxFiles: 100,
    filename: 'app-compressed',
    compress: true, // 启用 gzip 压缩
  },
})

// 示例 3: 同时启用自动清理和压缩
const loggerWithBoth = new Logger({
  level: 'info',
  name: 'full-featured',
  file: {
    enabled: true,
    path: './logs',
    maxSize: 5 * 1024 * 1024,
    maxFiles: 30,
    filename: 'app-full',
    maxAge: 30, // 保留 30 天
    compress: true, // 启用压缩
  },
})

// 示例 4: 短期日志，仅保留 3 天
const loggerShortTerm = new Logger({
  level: 'debug',
  name: 'short-term',
  file: {
    enabled: true,
    path: './logs/temp',
    maxSize: 1 * 1024 * 1024,
    maxFiles: 10,
    filename: 'temp',
    maxAge: 3, // 仅保留 3 天
    compress: false, // 不压缩（因为很快就会删除）
  },
})

// 记录一些测试日志
console.log('\n=== 测试自动清理功能 ===')
loggerWithAutoCleanup.info('这条日志将在 7 天后被自动删除')
loggerWithAutoCleanup.warn('重要：系统会自动清理超过 7 天的日志')

console.log('\n=== 测试压缩功能 ===')
loggerWithCompression.info('这条日志在超过 1 天后会被自动压缩为 .gz 文件')
loggerWithCompression.info('压缩可以节省大量磁盘空间')

console.log('\n=== 测试完整功能 ===')
loggerWithBoth.info('此配置会在 30 天后删除日志')
loggerWithBoth.info('超过 1 天的日志会被压缩')
loggerWithBoth.error('错误日志也会被同样处理')

console.log('\n=== 测试短期日志 ===')
loggerShortTerm.debug('临时调试信息，3 天后自动删除')
loggerShortTerm.info('这种配置适合临时日志或开发环境')

console.log('\n配置说明：')
console.log('- maxAge: 日志文件的最大保留天数（默认 30 天）')
console.log('- compress: 是否压缩超过 1 天的旧日志（默认 false）')
console.log('- 压缩使用 gzip 格式，压缩后的文件扩展名为 .log.gz')
console.log('- 压缩和清理会在日志轮转时自动执行')
console.log('\n优势：')
console.log('✓ 自动管理磁盘空间，无需手动清理')
console.log('✓ 压缩可节省 70-90% 的存储空间')
console.log('✓ 灵活配置，适应不同场景需求')
console.log('✓ 同时支持数量和时间两种清理策略')
