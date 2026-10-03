import { defineConfig } from 'vite-plus'
import vue from '@vitejs/plugin-vue'
import path from 'path'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@mollu/koru/topology': path.resolve(__dirname, '../src/topology'),
      '@mollu/koru/topology/style': path.resolve(__dirname, '../src/style'),
      '@': path.resolve(__dirname, 'src'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
})
