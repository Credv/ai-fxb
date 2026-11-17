import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 教案与课件挂在 3ecat.me/learn:资源与 SPA 回落都要带这个前缀。
export default defineConfig({
  plugins: [react()],
  base: '/learn/',
  server: { port: 5179, host: true, open: false },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    chunkSizeWarningLimit: 700,
    rollupOptions: { output: { manualChunks: { react: ['react', 'react-dom'] } } }
  }
})
