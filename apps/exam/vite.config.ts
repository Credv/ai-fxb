import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 模拟考挂在 3ecat.me/exam。wrangler 的 not_found_handling 是 none,子路径没有服务端回落,
// 所以卷面一律用 hash 路由(#/paper/1),资源前缀由这里的 base 决定。
export default defineConfig({
  plugins: [react()],
  base: '/exam/',
  server: { port: 5180, host: true, open: false },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: { manualChunks: { react: ['react', 'react-dom'] } }
    }
  }
})
