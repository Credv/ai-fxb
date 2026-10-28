import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 控制台挂在 3ecat.me/ai-fxb 子路径下:资源与 SPA 回落都要带这个前缀。
// 根路由归简历(apps/resume 独立构建,base '/')。
export default defineConfig({
  plugins: [react()],
  base: '/ai-fxb/',
  server: {
    port: 5178,
    host: true,
    open: false,
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom'],
          three: ['three'],
        },
      },
    },
  },
})
