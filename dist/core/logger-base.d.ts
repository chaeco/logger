import { LogLevel, SamplingOptions, RateLimitOptions, FilterOptions, FormatOptions, ErrorHandlingOptions, LoggerOptions, PerformanceMetrics } from './types';
import { FileManager } from '../file/file-manager';
import { LogFormatter } from '../utils/formatter';
/**
 * LoggerBase - 持有配置状态及所有 configure* 方法的抽象基类。
 * Logger 子类提供 formatter、fileManager 等具体实现。
 * @internal
 */
export declare abstract class LoggerBase {
    protected abstract level: LogLevel;
    protected abstract formatter: LogFormatter;
    protected abstract fileManager: FileManager | undefined;
    protected abstract consoleEnabled: boolean;
    /** 供 updateConfig 回调：等级变更时触发事件 */
    protected abstract emitLevelChange(newLevel: LogLevel, oldLevel: LogLevel): void;
    protected sampling: Required<SamplingOptions>;
    protected rateLimit: Required<RateLimitOptions>;
    protected rlWindowStart: number;
    protected rlWindowCount: number;
    protected filter: Required<FilterOptions>;
    protected errorHandling: {
        silent: boolean;
        onError?: (error: Error, context: string) => void;
        fallbackToConsole: boolean;
    };
    protected metrics: PerformanceMetrics;
    protected metricsN: number;
    protected readonly levelPriority: Record<LogLevel, number>;
    configureSampling(options: SamplingOptions): void;
    configureRateLimit(options: RateLimitOptions): void;
    configureFilter(options: FilterOptions): void;
    configureFormat(options: FormatOptions): void;
    configureErrorHandling(options: ErrorHandlingOptions): void;
    updateConfig(options: Partial<LoggerOptions>): void;
    getMetrics(): PerformanceMetrics;
    resetMetrics(): void;
}
//# sourceMappingURL=logger-base.d.ts.map