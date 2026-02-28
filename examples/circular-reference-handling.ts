/**
 * 示例：处理循环引用
 * 
 * 展示如何使用 Logger 处理包含循环引用的对象，
 * 比如 Express 的 Request/Response 对象
 */

import { Logger } from '../src/logger'

// 创建一个logger实例，带有文件输出
const logger = new Logger({
  name: 'circular-reference-demo',
  level: 'info',
  console: {
    enabled: true,
    colors: true,
    timestamp: true,
  },
  file: {
    enabled: true,
    path: './logs',
    maxSize: 10 * 1024 * 1024,
    maxFiles: 10,
  },
})

console.log('==== 循环引用处理演示 ====\n')

// 示例1：简单的循环引用
console.log('1. 处理简单的循环引用对象：')
const circularObj: any = {
  name: 'circular-test',
  data: {
    value: 42,
  },
}
// 创建循环引用
circularObj.self = circularObj
circularObj.data.parent = circularObj

logger.info('Logging object with circular reference', circularObj)
console.log('')

// 示例2：模拟Express Request对象的循环结构（模拟从错误消息中看到的问题）
console.log('2. 处理模拟的Express Request对象（带有socket循环引用）：')
const mockRequest: any = {
  method: 'POST',
  url: '/api/auth/login',
  headers: {
    'content-type': 'application/json',
    'user-agent': 'Mozilla/5.0',
  },
  body: {
    username: 'testuser',
    password: '***',
  },
}

// 模拟socket包含HTTPParser的循环结构
const httpParser: any = {
  type: 'HTTPParser',
}
const socket: any = {
  parser: httpParser,
}
httpParser.socket = socket
mockRequest.socket = socket

// 这不会抛出"Converting circular structure to JSON"错误
logger.info('🔍 Request body info', mockRequest)
console.log('')

// 示例3：在过滤函数中处理循环引用
console.log('3. 在过滤器中安全处理循环引用：')
const loggerWithFilter = new Logger({
  name: 'with-filter',
  level: 'info',
  console: { enabled: true },
  file: { enabled: false },
  filter: {
    enabled: true,
    mode: 'all',
    filters: [
      (entry) => {
        // 即使entry.data包含循环引用，这也不会失败
        // 因为logger内部使用safeStringify
        if (typeof entry.data === 'object') {
          return true // 允许所有包含数据的日志
        }
        return true
      },
    ],
  },
})

const complexData: any = {
  id: '123',
  nested: {
    level: 2,
  },
}
complexData.nested.root = complexData

loggerWithFilter.info('Filtered log with circular reference', complexData)
console.log('')

console.log('✅ 所有循环引用处理完成，没有错误！')
console.log('日志已保存到 ./logs 目录')
