import { AsyncQueue } from '../src/file/async-queue'

function makeOptions(overrides: Partial<{
  enabled: boolean; queueSize: number; batchSize: number
  flushInterval: number; overflowStrategy: 'drop' | 'block' | 'overflow'
}> = {}) {
  return {
    enabled: true,
    queueSize: 100,
    batchSize: 10,
    flushInterval: 60000, // 大值：禁止定时器自动刷新，由测试手动触发
    overflowStrategy: 'drop' as const,
    ...overrides,
  }
}

// ─── enqueue + flush ──────────────────────────────────────────────────────────

describe('AsyncQueue — enqueue & flush', () => {
  it('enqueue 后 size 增加', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions({ batchSize: 100 }), onFlush)
    await q.enqueue('msg1')
    expect(q.size).toBe(1)
    await q.stop()
  })

  it('flush 将消息传递给 onFlush', async () => {
    const received: string[][] = []
    const onFlush = jest.fn(async (msgs: string[]) => { received.push(msgs) })
    const q = new AsyncQueue(makeOptions({ batchSize: 100 }), onFlush)
    await q.enqueue('alpha')
    await q.enqueue('beta')
    await q.flush()
    expect(received[0]).toEqual(['alpha', 'beta'])
    await q.stop()
  })

  it('空队列 flush 不调用 onFlush', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions(), onFlush)
    await q.flush()
    expect(onFlush).not.toHaveBeenCalled()
    await q.stop()
  })

  it('flush 后 size 归零', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions({ batchSize: 100 }), onFlush)
    await q.enqueue('a')
    await q.enqueue('b')
    await q.flush()
    expect(q.size).toBe(0)
    await q.stop()
  })

  it('达到 batchSize 时立即触发 flush', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions({ batchSize: 3 }), onFlush)
    await q.enqueue('1')
    await q.enqueue('2')
    await q.enqueue('3') // 第 3 条触发自动 flush
    expect(onFlush).toHaveBeenCalledTimes(1)
    await q.stop()
  })
})

// ─── start / stop ─────────────────────────────────────────────────────────────

describe('AsyncQueue — start & stop', () => {
  it('stop 刷新剩余队列（不丢失消息）', async () => {
    const received: string[] = []
    const onFlush = jest.fn(async (msgs: string[]) => { received.push(...msgs) })
    const q = new AsyncQueue(makeOptions({ batchSize: 100, flushInterval: 60000 }), onFlush)
    await q.enqueue('x')
    await q.enqueue('y')
    await q.stop()
    expect(received).toContain('x')
    expect(received).toContain('y')
  })

  it('重复 stop 不抛出', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions(), onFlush)
    await q.stop()
    await expect(q.stop()).resolves.not.toThrow()
  })

  it('start 后定时器触发 flush', async () => {
    jest.useFakeTimers()
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions({ flushInterval: 500 }), onFlush)
    q.start()
    await q.enqueue('timed')
    jest.advanceTimersByTime(600)
    // 因为 flush 是异步的，手动等待微任务
    await Promise.resolve()
    expect(onFlush).toHaveBeenCalled()
    clearInterval((q as any).flushTimer)
    jest.useRealTimers()
  })

  it('重复 start 只启动一个定时器', () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(makeOptions(), onFlush)
    q.start()
    const t1 = (q as any).flushTimer
    q.start()
    const t2 = (q as any).flushTimer
    expect(t1).toBe(t2)
    clearInterval(t1)
  })
})

// ─── overflow 策略 ────────────────────────────────────────────────────────────

describe('AsyncQueue — overflow 策略', () => {
  it('策略 drop：队列满时新消息被丢弃', async () => {
    const onFlush = jest.fn(async () => { /* 永不刷新 */ })
    const q = new AsyncQueue(makeOptions({ queueSize: 3, batchSize: 100, overflowStrategy: 'drop' }), onFlush)
    // 填满队列
    for (let i = 0; i < 3; i++) (q as any).queue.push(`msg${i}`)
    // 再入队应被丢弃
    await q.enqueue('dropped')
    expect(q.size).toBe(3)
    await q.stop()
  })

  it('策略 block：队列满时等待 flush 后继续入队', async () => {
    const onFlush = jest.fn().mockResolvedValue(undefined)
    const q = new AsyncQueue(
      makeOptions({ queueSize: 2, batchSize: 10, overflowStrategy: 'block' }),
      onFlush,
    )
    // 填满
    for (let i = 0; i < 2; i++) (q as any).queue.push(`m${i}`)
    // enqueue 会先触发 flush 再入队
    await q.enqueue('new')
    expect(onFlush).toHaveBeenCalled()
    await q.stop()
  })
})

// ─── flush 失败退回 ───────────────────────────────────────────────────────────

describe('AsyncQueue — flush 失败退回', () => {
  it('onFlush 抛出时消息重新入队', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => { })
    let callCount = 0
    const onFlush = jest.fn(async () => {
      callCount++
      if (callCount === 1) throw new Error('write fail')
    })
    const q = new AsyncQueue(makeOptions({ batchSize: 100 }), onFlush)
    await q.enqueue('important')
    // 第一次 flush 失败，消息应退回
    await q.flush()
    expect(q.size).toBeGreaterThan(0)
    // 第二次 flush 成功
    await q.flush()
    expect(q.size).toBe(0)
    spy.mockRestore()
    await q.stop()
  })
})
