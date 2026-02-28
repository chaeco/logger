import { ColorUtils } from '../src/utils/color-utils'

describe('ColorUtils', () => {
  it('should return level colors', () => {
    expect(ColorUtils.getLevelColor('debug')).toBeDefined()
    expect(ColorUtils.getLevelColor('info')).toBeDefined()
    expect(ColorUtils.getLevelColor('warn')).toBeDefined()
    expect(ColorUtils.getLevelColor('error')).toBeDefined()
  })

  it('should colorize level', () => {
    const result = ColorUtils.colorizeLevel('info')
    expect(result).toBeDefined()
    expect(typeof result).toBe('string')
  })

  it('should colorize timestamp', () => {
    const result = ColorUtils.colorizeTimestamp('2024-01-01 00:00:00')
    expect(result).toBeDefined()
  })

  it('should colorize name', () => {
    const result = ColorUtils.colorizeName('test-logger')
    expect(result).toBeDefined()
  })

  it('should colorize file location', () => {
    const result = ColorUtils.colorizeFileLocation('file.ts:10')
    expect(result).toBeDefined()
  })

  it('should colorize message', () => {
    const result = ColorUtils.colorizeMessage('info', 'test message')
    expect(result).toBeDefined()
  })
})
