/**
 * 自动初始化功能测试示例
 */
import { Logger } from '../src/index'
import path from 'path'
import fs from 'fs'

console.log('=== 自动初始化测试 ===\n')

// 测试 1: 创建 Logger（不会立即初始化）
console.log('测试 1: 创建 Logger（不会立即初始化）')
const testLogPath = path.join(__dirname, '../test-logs-auto-init')

const logger = new Logger({
  name: 'auto-init-test',
  file: {
    enabled: true,
    path: testLogPath,
  },
  console: {
    enabled: true,
    colors: true,
    timestamp: true,
  }
})

// 此时目录不应该存在
console.log(`✓ Logger 创建完成`)
console.log(`  目录是否存在: ${fs.existsSync(testLogPath) ? '是' : '否'}（预期：否）\n`)

// 测试 2: 记录日志（首次写入时自动初始化）
console.log('测试 2: 记录日志（首次写入时自动初始化）')
logger.info('这是第一条日志，会自动创建目录')
console.log(`  目录是否存在: ${fs.existsSync(testLogPath) ? '是' : '否'}（预期：是）\n`)

// 测试 3: 继续记录日志
console.log('测试 3: 继续记录日志')
logger.warn('这是一条警告')
logger.error('这是一条错误')

// 等待异步写入完成
setTimeout(() => {
  const files = fs.existsSync(testLogPath) ? fs.readdirSync(testLogPath) : []
  console.log(`  日志文件数量: ${files.length}`)
  if (files.length > 0) {
    console.log(`  日志文件: ${files.join(', ')}`)
  }
  console.log('\n=== 测试完成 ===')
  console.log('\n✅ 总结：')
  console.log('   - 创建 Logger 时不会立即初始化')
  console.log('   - 首次写入日志时自动创建目录和文件')
  console.log('   - 用户无需关心初始化时机\n')
}, 1000)
