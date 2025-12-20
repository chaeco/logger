import chalk from 'chalk';
/**
 * 颜色工具类
 * @internal
 * @remarks
 * 用于处理控制台输出的颜色。为不同级别的日志提供不同的颜色显示。
 */
export declare class ColorUtils {
    static getLevelColor(level: string): typeof chalk;
    static colorizeLevel(level: string): string;
    static colorizeTimestamp(timestamp: string): string;
    static colorizeName(name: string): string;
    static colorizeFileLocation(location: string): string;
    static colorizeMessage(level: string, message: string): string;
}
//# sourceMappingURL=color-utils.d.ts.map