"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ColorUtils = void 0;
const chalk_1 = __importDefault(require("chalk"));
/**
 * 颜色工具类
 * @internal
 * @remarks
 * 用于处理控制台输出的颜色。为不同级别的日志提供不同的颜色显示。
 */
class ColorUtils {
    static getLevelColor(level) {
        switch (level.toLowerCase()) {
            case 'debug':
                return chalk_1.default.gray;
            case 'info':
                return chalk_1.default.blue;
            case 'warn':
                return chalk_1.default.yellow;
            case 'error':
                return chalk_1.default.red;
            default:
                return chalk_1.default.white;
        }
    }
    static colorizeLevel(level) {
        const color = this.getLevelColor(level);
        return color(level.toUpperCase().padEnd(5));
    }
    static colorizeTimestamp(timestamp) {
        return chalk_1.default.gray(timestamp);
    }
    static colorizeName(name) {
        return chalk_1.default.cyan(`[${name}]`);
    }
    static colorizeFileLocation(location) {
        return chalk_1.default.gray(`(${location})`);
    }
    static colorizeMessage(level, message) {
        const color = this.getLevelColor(level);
        return color(message);
    }
}
exports.ColorUtils = ColorUtils;
//# sourceMappingURL=color-utils.js.map