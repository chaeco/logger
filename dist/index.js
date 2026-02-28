"use strict";
/**
 * @chaeco/logger - 功能完整的日志模块
 *
 * @remarks
 * 支持 Node.js 和浏览器环境，提供多级别日志、彩色输出、文件写入、错误事件处理、
 * 日志采样、限流和日志收集服务等功能。
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.detectEnvironment = exports.currentEnvironment = exports.isBrowserEnvironment = exports.isNodeEnvironment = exports.logger = exports.Logger = void 0;
const logger_1 = require("./core/logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
/**
 * 默认 Logger 实例（name: 'app'，level: 'info'，写入 ./logs）
 */
exports.logger = new logger_1.Logger({
    name: 'app',
    file: { enabled: true, path: './logs', maxSize: 10 * 1024 * 1024, maxFiles: 30 },
    console: { enabled: true, colors: true, timestamp: true },
});
var environment_1 = require("./utils/environment");
Object.defineProperty(exports, "isNodeEnvironment", { enumerable: true, get: function () { return environment_1.isNodeEnvironment; } });
Object.defineProperty(exports, "isBrowserEnvironment", { enumerable: true, get: function () { return environment_1.isBrowserEnvironment; } });
Object.defineProperty(exports, "currentEnvironment", { enumerable: true, get: function () { return environment_1.currentEnvironment; } });
Object.defineProperty(exports, "detectEnvironment", { enumerable: true, get: function () { return environment_1.detectEnvironment; } });
//# sourceMappingURL=index.js.map