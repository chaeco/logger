import { isNodeEnvironment, isBrowserEnvironment, currentEnvironment } from '../src/environment'

describe('Environment Detection', () => {
  it('should detect Node.js environment', () => {
    expect(isNodeEnvironment).toBe(true)
    expect(isBrowserEnvironment).toBe(false)
  })

  it('should return correct environment name', () => {
    expect(currentEnvironment).toBe('node')
  })
})
