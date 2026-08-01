import { formatDate, formatNow } from '../src/utils/date-utils'

describe('date-utils — formatDate()', () => {
  it('支持 Date 输入', () => {
    const d = new Date('2026-03-23T12:34:56.789Z')
    const out = formatDate(d, 'YYYY-MM-DD HH:mm:ss.SSS')
    expect(out).toContain('2026-03-23')
  })

  it('支持 ISO 字符串输入', () => {
    const out = formatDate('2026-03-23T00:00:00.000Z', 'YYYY-MM-DD')
    expect(out).toContain('2026-03-23')
  })

  it('支持时间戳输入', () => {
    const ts = Date.parse('2026-03-23T00:00:00.000Z')
    const out = formatDate(ts, 'YYYY-MM-DD')
    expect(out).toContain('2026-03-23')
  })

  it('格式化包含所有令牌', () => {
    const d = new Date('2026-03-23T01:02:03.004Z')
    const out = formatDate(d, 'YYYY MM DD HH mm ss SSS')
    expect(out.split(' ').length).toBe(7)
  })

  it('无效日期返回 NaN-NaN-NaN', () => {
    const out = formatDate('not-a-date', 'YYYY-MM-DD')
    expect(out).toContain('NaN')
  })
})

describe('date-utils — formatNow()', () => {
  it('按指定格式输出当前时间', () => {
    jest.useFakeTimers()
    jest.setSystemTime(new Date('2026-03-23T01:02:03.004Z'))
    const out = formatNow('YYYY-MM-DD HH:mm:ss.SSS')
    expect(out).toContain('2026-03-23')
    jest.useRealTimers()
  })
})
