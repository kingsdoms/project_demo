// vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  css: {
    // Giữ tên class gốc trong class đã băm để theme.css nhắm được các nút chính.
    modules: { generateScopedName: '[local]_[hash:base64:6]' },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: ['.ngrok-free.dev'],
    hmr: {
      clientPort: 443,
    },
  },
})