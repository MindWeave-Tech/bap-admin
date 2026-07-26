import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The admin app talks to the BAP API. In development requests are proxied so
// the browser sees a single origin and no CORS configuration is needed.
// Test configuration lives in vitest.config.ts.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_API_TARGET ?? 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
