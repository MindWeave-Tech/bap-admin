import { describe, expect, it, vi } from 'vitest'

/**
 * Configuration is read once at module load, so each case re-imports the
 * module with a different environment stubbed in.
 */
async function loadConfig(env: Record<string, string | undefined>) {
  vi.resetModules()

  for (const [key, value] of Object.entries(env)) {
    vi.stubEnv(key, value)
  }

  const module = await import('./config')

  return module
}

describe('config', () => {
  it('defaults to the proxied base path and the local environment', async () => {
    const { config, isProduction } = await loadConfig({
      VITE_API_BASE_URL: undefined,
      VITE_ENVIRONMENT: undefined,
    })

    expect(config.apiBaseUrl).toBe('/api')
    expect(config.environment).toBe('local')
    expect(isProduction).toBe(false)
  })

  it('accepts an absolute base URL for a cross-origin API', async () => {
    const { config } = await loadConfig({ VITE_API_BASE_URL: 'https://api.example.test/api' })

    expect(config.apiBaseUrl).toBe('https://api.example.test/api')
  })

  it('strips a trailing slash so appended paths do not double up', async () => {
    const { config } = await loadConfig({ VITE_API_BASE_URL: 'https://api.example.test/api/' })

    expect(config.apiBaseUrl).toBe('https://api.example.test/api')
  })

  it('recognises production and treats anything unknown as local', async () => {
    expect((await loadConfig({ VITE_ENVIRONMENT: 'production' })).isProduction).toBe(true)
    expect((await loadConfig({ VITE_ENVIRONMENT: 'SANDBOX' })).config.environment).toBe('sandbox')
    expect((await loadConfig({ VITE_ENVIRONMENT: 'staging' })).config.environment).toBe('local')
  })
})
