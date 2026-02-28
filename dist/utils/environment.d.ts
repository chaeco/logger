/**
 * 环境检测和类型定义
 * @internal
 */
export type Environment = 'node' | 'browser';
/**
 * 检测当前运行环境
 * @internal
 * @returns 'node' 或 'browser'
 */
export declare function detectEnvironment(): Environment;
/**
 * 获取当前环境
 * @internal
 */
export declare const currentEnvironment: Environment;
/**
 * 是否运行在 Node.js 环境
 * @internal
 */
export declare const isNodeEnvironment: boolean;
/**
 * 是否运行在浏览器环境
 * @internal
 */
export declare const isBrowserEnvironment: boolean;
//# sourceMappingURL=environment.d.ts.map