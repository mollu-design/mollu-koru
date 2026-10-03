import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'
import dts from 'vite-plugin-dts'

// 检测当前命令：dev (watch模式) vs build (生产模式)
// 开发/监听模式跳过 dts 以加速，仅在生产构建时生成类型声明
const isWatchMode = process.argv.includes('--watch') || process.argv.includes('dev')
const isBuildCommand = !isWatchMode

export default defineConfig({
  plugins: [
    vue(),
    // dts 仅在生产构建时启用
    ...(isBuildCommand
      ? [
          dts({
            outDir: 'dist',
            include: ['src/**/*.ts', 'src/**/*.vue'],
            exclude: [
              'src/**/*.spec.ts',
              'src/**/*.test.ts',
              'src/**/__tests__/**',
              'src/demo/**',
              'src/playground/**',
            ],
          }),
        ]
      : []),
  ],
  build: {
    outDir: 'dist',
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'topology/index': resolve(__dirname, 'src/topology/index.ts'),
        'plugins/flow/index': resolve(__dirname, 'src/plugins/flow/index.ts'),
      },
      name: 'MolluKoru',
      formats: ['es', 'cjs'],
      fileName: (format, entryName) => {
        const ext = format === 'es' ? 'es.js' : 'cjs'
        return `${entryName}.${ext}`
      },
    },
    rollupOptions: {
      // 重型依赖交给业务侧安装，组件库只导出自身封装代码
      external: [
        'vue',
        '@antv/x6',
        '@arco-design/web-vue',
        // arco 子路径导入（如 @arco-design/web-vue/es/icon）
        /^@arco-design\/web-vue\/.+$/,
      ],
      output: {
        exports: 'named',
        globals: {
          vue: 'Vue',
          '@antv/x6': 'X6',
          '@arco-design/web-vue': 'ArcoVue',
        },
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') return 'style/koru.css'
          if (assetInfo.name?.endsWith('.css')) return `style/${assetInfo.name}`
          return assetInfo.name || 'assets/[name]-[hash][extname]'
        },
      },
    },
    cssCodeSplit: true,
  },
})
