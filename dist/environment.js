"use strict";
/**
 * 环境检测和类型定义
 * @internal
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isBrowserEnvironment = exports.isNodeEnvironment = exports.currentEnvironment = exports.detectEnvironment = void 0;
/**
 * 检测当前运行环境
 * @internal
 * @returns 'node' 或 'browser'
 */
function detectEnvironment() {
    // 检查是否为 Node.js 环境
    if (typeof process !== 'undefined' &&
        process.versions &&
        process.versions.node) {
        return 'node';
    }
    // 检查是否为浏览器环境
    if (typeof window !== 'undefined' || typeof document !== 'undefined') {
        return 'browser';
    }
    // 默认认为是浏览器环境（因为大多数现代运行时是类浏览器的）
    return 'browser';
}
exports.detectEnvironment = detectEnvironment;
/**
 * 获取当前环境
 * @internal
 */
exports.currentEnvironment = detectEnvironment();
/**
 * 是否运行在 Node.js 环境
 * @internal
 */
exports.isNodeEnvironment = exports.currentEnvironment === 'node';
/**
 * 是否运行在浏览器环境
 * @internal
 */
exports.isBrowserEnvironment = exports.currentEnvironment === 'browser';
//# sourceMappingURL=environment.js.map