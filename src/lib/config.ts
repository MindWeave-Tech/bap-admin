/**
 * Console configuration, read once from the Vite environment.
 *
 * Every VITE_ variable is inlined into the bundle at build time, so these are
 * public values only — never a secret. Defaults keep a fresh checkout working
 * without a .env file; see .env.example for what each one does.
 */

export type EnvironmentName = 'local' | 'sandbox' | 'production'

function environmentName(raw: string | undefined): EnvironmentName {
  const value = (raw ?? 'local').trim().toLowerCase()

  return value === 'production' || value === 'sandbox' ? value : 'local'
}

/** Trailing slashes would double up when paths are appended. */
function trimTrailingSlash(value: string): string {
  return value.endsWith('/') && value.length > 1 ? value.slice(0, -1) : value
}

export const config = {
  apiBaseUrl: trimTrailingSlash((import.meta.env.VITE_API_BASE_URL ?? '/api').trim() || '/api'),
  environment: environmentName(import.meta.env.VITE_ENVIRONMENT),
} as const

/** Production is the one an operator must never mistake for a rehearsal. */
export const isProduction = config.environment === 'production'
