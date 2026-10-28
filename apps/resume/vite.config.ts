import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  server: {
    port: 3000,
    open: true,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // 框架与业务代码分开:改简历文案时不会让用户重新下载 React(资源带 content-hash 长缓存)
        manualChunks: {
          react: ['react', 'react-dom'],
        },
      },
    },
  },
})
