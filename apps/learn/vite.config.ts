import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

// 备课台挂在 3ecat.me/learn:资源与 SPA 回落都要带这个前缀。
// 只剩一个入口了——课件那半已经拆掉,整站都是要密码才解得开的。
export default defineConfig({
  plugins: [react()],
  base: '/learn/',
  server: { port: 5179, host: true, open: false },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      input: { main: here + 'index.html' },
      output: { manualChunks: { react: ['react', 'react-dom'] } }
    }
  }
})
