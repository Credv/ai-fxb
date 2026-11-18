import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const here = fileURLToPath(new URL('.', import.meta.url))

// 教案与课件挂在 3ecat.me/learn:资源与 SPA 回落都要带这个前缀。
// 两个入口:课件(老师那一张)与 student/ 学生版。学生版是另一份 HTML,
// 打包时不会把私密区的字样带进去。
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
      input: { main: here + 'index.html', student: here + 'student/index.html' },
      output: { manualChunks: { react: ['react', 'react-dom'] } }
    }
  }
})
