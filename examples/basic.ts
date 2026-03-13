/**
 * @chaeco/logger — 基础用法示例
 *
 * 演示快速上手、日志级别、子 Logger 和运行时配置。
 */

import { Logger, logger } from '../src/index'

// ─── 1. 使用默认实例（开箱即用）────────────────────────────────────────────────

logger.info('应用启动')
logger.warn('内存使用率偏高', { usage: '78%' })
logger.error('数据库连接失败', new Error('ECONNREFUSED'))

// ─── 2. 创建自定义 Logger ────────────────────────────────────────────────────

const appLogger = new Logger({
  name: 'app',
  level: 'debug',
  file: {
    enabled: true,
    path: './logs',
    filename: 'app',
    maxSize: 10 * 1024 * 1024, // 10 MB
    maxFiles: 30,
    maxAge: 7,
    compress: true,
  },
  console: { enabled: true, colors: true, timestamp: true },
})

appLogger.debug('调试模式已启用')
appLogger.info('服务初始化完成', { port: 3000 })

// ─── 3. 子 Logger（继承父配置）───────────────────────────────────────────────

const dbLogger = appLogger.child('db')
dbLogger.info('已连接到 PostgreSQL')   // 输出：[app:db] INFO ...

const httpLogger = appLogger.child('http')
httpLogger.info('GET /api/users 200')  // 输出：[app:http] INFO ...

// ─── 4. 日志级别控制 ─────────────────────────────────────────────────────────

appLogger.setLevel('warn')   // 运行时提升级别，debug/info 不再输出
appLogger.warn('级别已提升至 warn')
appLogger.setLevel('debug')  // 恢复

// ─── 5. 参数变参调用 ─────────────────────────────────────────────────────────

appLogger.info('请求处理完成', { duration: 42, status: 200 })
appLogger.error(new Error('未捕获的异常'))
appLogger.debug('多参调试', { a: 1 }, { b: 2 })

// ─── 6. 生命周期 ─────────────────────────────────────────────────────────────

async function main() {
  appLogger.info('程序即将退出')
  await appLogger.close() // 刷新异步队列，确保所有日志落盘
}

main().catch(console.error)
