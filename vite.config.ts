import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Configuration comes from .env — see .env.example. Test configuration lives
// in vitest.config.ts.
export default defineConfig(({ mode }) => {
  // The third argument is the prefix filter; '' loads every variable so the
  // proxy target can be read even though it is not sent to the browser.
  const env = loadEnv(mode, process.cwd(), '')

  // Only a same-origin base path can be proxied. An absolute base URL means
  // the console talks to another origin directly, and CORS is the API's job.
  const basePath = (env.VITE_API_BASE_URL || '/api').trim()
  const proxyPath = basePath.startsWith('/') ? basePath : null

  return {
    plugins: [react()],
    server: {
      proxy: proxyPath
        ? {
            [proxyPath]: {
              target: env.VITE_API_PROXY_TARGET || 'http://localhost:8000',
              changeOrigin: true,
            },
          }
        : undefined,
    },
  }
})
