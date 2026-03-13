// chalk mock：所有颜色方法直接返回原始字符串，测试中不产生 ANSI 转义码
const identity = (s: string) => s

// 缓存属性访问，保证同名属性始终返回同一函数引用（支持 toBe 引用相等断言）
const cache: Record<string, (s: string) => string> = {}

const chalk: any = new Proxy(identity, {
  get(_target, prop: string) {
    if (prop === 'level') return 1
    if (!cache[prop]) cache[prop] = identity
    return cache[prop]
  },
  apply(_target, _thisArg, args: string[]) {
    return args[0] ?? ''
  },
})

export default chalk
