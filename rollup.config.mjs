import typescript from '@rollup/plugin-typescript'
import { nodeResolve } from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import dts from 'rollup-plugin-dts'

// Node built-ins are resolved by Node at runtime; keep them external.
const external = [/^node:/, 'fs', 'path', 'os', 'util', 'stream', 'events', 'crypto']

const config = [
  // CJS bundle — single file for Node consumption
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/index.js',
      format: 'cjs',
      exports: 'named',
      sourcemap: true,
    },
    plugins: [
      nodeResolve({ extensions: ['.ts', '.js'] }),
      commonjs(),
      typescript({ tsconfig: './tsconfig.json' }),
    ],
    external,
  },
  // Type declarations — single bundled .d.ts
  {
    input: 'src/index.ts',
    output: { file: 'dist/index.d.ts', format: 'es' },
    plugins: [dts({ tsconfig: './tsconfig.build.json', respectExternal: true })],
    external,
  },
]

export default config
