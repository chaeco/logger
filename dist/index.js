"use strict";
/**
 * @chaeco/logger - 功能完整的日志模块
 *
 * @remarks
 * 仅支持 Node.js 运行时，提供多级别日志、彩色控制台输出、文件写入和错误事件处理等功能。
 *
 * @packageDocumentation
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.logger = exports.Logger = void 0;
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
//# sourceMappingURL=index.js.map