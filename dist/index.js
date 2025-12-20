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
var logger_1 = require("./logger");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return logger_1.Logger; } });
Object.defineProperty(exports, "logger", { enumerable: true, get: function () { return logger_1.logger; } });
var environment_1 = require("./environment");
Object.defineProperty(exports, "isNodeEnvironment", { enumerable: true, get: function () { return environment_1.isNodeEnvironment; } });
Object.defineProperty(exports, "isBrowserEnvironment", { enumerable: true, get: function () { return environment_1.isBrowserEnvironment; } });
Object.defineProperty(exports, "currentEnvironment", { enumerable: true, get: function () { return environment_1.currentEnvironment; } });
Object.defineProperty(exports, "detectEnvironment", { enumerable: true, get: function () { return environment_1.detectEnvironment; } });
//# sourceMappingURL=index.js.map