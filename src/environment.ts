/**
 * 环境检测和类型定义
 * @internal
 */

export type Environment = 'node' | 'browser'

/**
 * 检测当前运行环境
 * @internal
 * @returns 'node' 或 'browser'
 */
export function detectEnvironment(): Environment {
  // 检查是否为 Node.js 环境
  if (
    typeof process !== 'undefined' &&
    process.versions &&
    process.versions.node
  ) {
    return 'node'
  }

  // 检查是否为浏览器环境
  if (typeof window !== 'undefined' || typeof document !== 'undefined') {
    return 'browser'
  }

  // 默认认为是浏览器环境（因为大多数现代运行时是类浏览器的）
  return 'browser'
}

/**
 * 获取当前环境
 * @internal
 */
export const currentEnvironment: Environment = detectEnvironment()

/**
 * 是否运行在 Node.js 环境
 * @internal
 */
export const isNodeEnvironment = currentEnvironment === 'node'

/**
 * 是否运行在浏览器环境
 * @internal
 */
export const isBrowserEnvironment = currentEnvironment === 'browser'
