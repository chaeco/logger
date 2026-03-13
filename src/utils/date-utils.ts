/**
 * 原生日期格式化工具，替代 dayjs。
 * 支持格式令牌：YYYY MM DD HH mm ss SSS
 * @internal
 */
function pad(n: number, len = 2): string {
  return String(n).padStart(len, '0')
}

/**
 * 将日期按指定格式输出字符串。
 * @param date  - Date 对象、ISO 字符串或时间戳（毫秒）
 * @param format - 格式字符串，支持 YYYY MM DD HH mm ss SSS
 */
export function formatDate(date: Date | string | number, format: string): string {
  const d = date instanceof Date ? date : new Date(date)
  return format
    .replace('YYYY', String(d.getFullYear()))
    .replace('MM', pad(d.getMonth() + 1))
    .replace('DD', pad(d.getDate()))
    .replace('HH', pad(d.getHours()))
    .replace('mm', pad(d.getMinutes()))
    .replace('ss', pad(d.getSeconds()))
    .replace('SSS', pad(d.getMilliseconds(), 3))
}

/** 以指定格式输出当前时间字符串。 */
export function formatNow(format: string): string {
  return formatDate(new Date(), format)
}
