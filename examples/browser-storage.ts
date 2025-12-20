/**
 * 浏览器 IndexedDB 存储示例
 * 演示如何在浏览器中使用 @chaeco/logger 的 IndexedDB 存储功能
 */

import { Logger } from '../src/index'

/**
 * 示例 1: 基础使用 - 启用 IndexedDB 存储
 */
export async function basicStorageExample() {
  const logger = new Logger({
    level: 'debug',
    console: { enabled: true, timestamp: true },
    file: {
      enabled: true,
      maxFiles: 100,  // 最多保存 100 条日志
    },
  })

  console.log('=== 基础 IndexedDB 存储示例 ===')

  // 记录各种级别的日志
  logger.debug('调试信息')
  logger.info('应用启动')
  logger.warn('资源不足')
  logger.error('发生错误', { code: 500 })

  // 等待异步操作完成
  await new Promise((resolve) => setTimeout(resolve, 100))

  // 查询存储的日志
  const allLogs = await logger.queryStoredLogs({ limit: 100 })
  console.log(`✓ 存储了 ${allLogs.length} 条日志`)

  // 显示最后一条日志
  if (allLogs.length > 0) {
    const lastLog = allLogs[allLogs.length - 1]
    console.log('最后一条日志:', {
      date: lastLog.date,
      timestamp: lastLog.timestamp,
      content: lastLog.content,
    })
  }
}

/**
 * 示例 2: 日志分页查询
 */
export async function paginationExample() {
  const logger = new Logger({
    level: 'info',
    console: { enabled: false },  // 关闭控制台输出，只保存到存储
    file: { enabled: true, maxFiles: 200 },
  })

  console.log('=== 日志分页查询示例 ===')

  // 生成一些测试日志
  for (let i = 0; i < 50; i++) {
    logger.info(`测试日志 #${i}`, { index: i, timestamp: Date.now() })
  }

  // 等待写入完成
  await new Promise((resolve) => setTimeout(resolve, 100))

  // 分页查询
  const pageSize = 10
  let page = 0

  while (true) {
    const offset = page * pageSize
    const logs = await logger.queryStoredLogs({
      limit: pageSize,
      offset: offset,
    })

    if (logs.length === 0) break

    console.log(`📄 第 ${page + 1} 页 (${offset + 1}-${offset + logs.length}):`)
    logs.forEach((log, i) => {
      console.log(`  ${i + 1}. [${log.date}] ${log.content}`)
    })

    page++
  }
}

/**
 * 示例 3: 日期过滤和查询
 */
export async function dateFilterExample() {
  const logger = new Logger({
    level: 'info',
    console: { enabled: false },
    file: { enabled: true, maxFiles: 150 },
  })

  console.log('=== 日期过滤示例 ===')

  // 记录当前日期的日志
  const today = new Date().toISOString().split('T')[0]
  logger.info(`今日日志 - ${today}`)

  // 等待写入
  await new Promise((resolve) => setTimeout(resolve, 50))

  // 查询今日日志
  const todayLogs = await logger.queryStoredLogs({
    limit: 100,
    date: today,
  })

  console.log(`✓ 今日 (${today}) 共有 ${todayLogs.length} 条日志`)

  // 查询所有日志
  const allLogs = await logger.queryStoredLogs({ limit: 1000 })

  // 按日期分组
  const logsByDate: { [key: string]: any[] } = {}
  allLogs.forEach((log) => {
    if (!logsByDate[log.date]) {
      logsByDate[log.date] = []
    }
    logsByDate[log.date].push(log)
  })

  console.log('按日期统计:', Object.keys(logsByDate).map((date) => ({
    date,
    count: logsByDate[date].length,
  })))
}

/**
 * 示例 4: 错误日志监控
 */
export async function errorMonitoringExample() {
  const logger = new Logger({
    level: 'debug',
    console: { enabled: false },
    file: { enabled: true, maxFiles: 200 },
  })

  console.log('=== 错误日志监控示例 ===')

  // 监听日志错误事件
  logger.on('error', (event) => {
    console.error('❌ 日志系统错误:', event.message)
  })

  // 记录混合的日志
  for (let i = 0; i < 20; i++) {
    if (i % 5 === 0) {
      logger.error(`错误 #${i}`, { errorCode: 'ERR_' + i })
    } else if (i % 3 === 0) {
      logger.warn(`警告 #${i}`)
    } else {
      logger.info(`信息 #${i}`)
    }
  }

  // 等待写入完成
  await new Promise((resolve) => setTimeout(resolve, 100))

  // 分析错误
  const allLogs = await logger.queryStoredLogs({ limit: 1000 })
  const errorLogs = allLogs.filter((log) => log.content.includes('ERROR'))
  const warnLogs = allLogs.filter((log) => log.content.includes('WARN'))

  console.log('📊 日志统计:')
  console.log(`  - 总日志数: ${allLogs.length}`)
  console.log(`  - 错误日志: ${errorLogs.length}`)
  console.log(`  - 警告日志: ${warnLogs.length}`)

  if (errorLogs.length > 0) {
    console.log('❌ 错误日志明细:')
    errorLogs.slice(0, 5).forEach((log) => {
      console.log(`  - ${log.content}`)
    })
  }
}

/**
 * 示例 5: 日志导出和清理
 */
export async function exportAndCleanupExample() {
  const logger = new Logger({
    level: 'info',
    console: { enabled: false },
    file: { enabled: true, maxFiles: 100 },
  })

  console.log('=== 日志导出和清理示例 ===')

  // 记录一些日志
  for (let i = 0; i < 30; i++) {
    logger.info(`导出测试日志 #${i}`)
  }

  await new Promise((resolve) => setTimeout(resolve, 100))

  // 查询日志
  const logs = await logger.queryStoredLogs({ limit: 100 })
  console.log(`✓ 查询到 ${logs.length} 条日志`)

  // 导出为 JSON
  const jsonData = {
    exportTime: new Date().toISOString(),
    totalLogs: logs.length,
    logs: logs,
  }

  console.log('📦 导出的 JSON 数据:')
  console.log(JSON.stringify(jsonData, null, 2).substring(0, 200) + '...')

  // 导出为 CSV
  const csvHeader = 'Date,Timestamp,Content\n'
  const csvRows = logs
    .map((log) => `"${log.date}",${log.timestamp},"${log.content.replace(/"/g, '""')}"`)
    .join('\n')
  const csvData = csvHeader + csvRows

  console.log('📄 导出的 CSV 数据 (前 3 行):')
  const csvLines = csvData.split('\n')
  csvLines.slice(0, 4).forEach((line) => console.log(line))

  // 清理日志
  console.log('🗑️ 清理日志...')
  await logger.clearStoredLogs()
  const afterCleanup = await logger.queryStoredLogs({ limit: 100 })
  console.log(`✓ 清理后剩余日志数: ${afterCleanup.length}`)
}

/**
 * 示例 6: 结合日志收集服务
 */
export async function withCollectorExample() {
  const logger = new Logger({
    level: 'info',
    console: { enabled: true, timestamp: true },
    file: {
      enabled: true,
      maxFiles: 50,  // 本地保存 50 条
    },
  })

  console.log('=== IndexedDB 存储示例 ===')

  // 记录日志
  logger.info('用户登录')
  logger.warn('可能的性能问题')
  logger.error('网络请求失败')

  await new Promise((resolve) => setTimeout(resolve, 100))

  // 查看本地存储
  const localLogs = await logger.queryStoredLogs({ limit: 50 })
  console.log(`💾 本地存储: ${localLogs.length} 条日志`)

  // 获取指标
  const metrics = logger.getMetrics()
  console.log('📊 日志指标:', {
    totalLogs: metrics.totalLogs,
    sampledLogs: metrics.sampledLogs,
    droppedLogs: metrics.droppedLogs,
  })
}

/**
 * 示例 7: 生产环境最佳实践
 */
export async function productionBestPractices() {
  // 根据环境选择配置
  const isProduction = process.env.NODE_ENV === 'production'

  const logger = new Logger({
    level: isProduction ? 'warn' : 'debug',
    console: { enabled: true, colors: !isProduction },
    file: {
      enabled: true,
      maxFiles: isProduction ? 20 : 100,  // 生产环境少保存
    },
  })

  console.log('=== 生产环境最佳实践 ===')

  // 监听所有错误
  logger.on('error', (event) => {
    console.error('日志系统错误:', event)

    // 生产环境下可以发送到错误跟踪服务
    if (isProduction) {
      // reportErrorToService(event)
    }
  })

  // 监听限流事件
  logger.on('rateLimitExceeded', (event) => {
    console.warn('日志限流触发:', event.message)
  })

  // 定期清理日志（每 6 小时）
  const cleanupInterval = 6 * 60 * 60 * 1000
  setInterval(async () => {
    const logs = await logger.queryStoredLogs({ limit: 1000 })

    // 保留最近的日志，删除旧的
    if (logs.length > 100) {
      console.log(`📊 日志数量: ${logs.length}, 即将清理旧日志`)
      await logger.clearStoredLogs()
    }
  }, cleanupInterval)

  console.log('✓ 生产环境日志系统已配置')
  console.log(`  - 日志级别: ${logger['level'] || 'info'}`)
  console.log(`  - 存储启用: 是`)
  console.log(`  - 自动清理: 每 ${cleanupInterval / 1000 / 3600} 小时`)
}

/**
 * 运行所有示例
 */
export async function runAllExamples() {
  console.log('🚀 开始运行浏览器 IndexedDB 存储示例\n')

  if (typeof window === 'undefined') {
    console.warn('⚠️ 这些示例仅在浏览器环境中运行')
    return
  }

  try {
    await basicStorageExample()
    console.log()

    await paginationExample()
    console.log()

    await dateFilterExample()
    console.log()

    await errorMonitoringExample()
    console.log()

    await exportAndCleanupExample()
    console.log()

    await withCollectorExample()
    console.log()

    await productionBestPractices()

    console.log('\n✅ 所有示例运行完成！')
  } catch (error) {
    console.error('❌ 示例执行失败:', error)
  }
}
