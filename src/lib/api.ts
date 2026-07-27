/**
 * Thin API client for the BAP admin API.
 *
 * Two behaviours matter beyond plain fetch:
 *  - the platform's standard error envelope (PRD §15) is parsed into a typed
 *    ApiError, so callers get `code`, `category`, and field-level `details`
 *    rather than a bare status;
 *  - a sensitive action answered with RECENT_AUTHENTICATION_REQUIRED is
 *    surfaced distinctly, so the UI can prompt for a password and retry
 *    instead of showing a dead end.
 */

import { config } from './config'

export interface ApiErrorDetail {
  field?: string
  message: string
}

export interface ApiErrorBody {
  code: string
  message: string
  category: string
  retryable: boolean
  transactionReference?: string
  details?: ApiErrorDetail[]
}

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly category: string
  readonly retryable: boolean
  readonly details: ApiErrorDetail[]
  readonly correlationId?: string

  constructor(status: number, body: Partial<ApiErrorBody>, correlationId?: string) {
    super(body.message ?? 'The request failed.')
    this.name = 'ApiError'
    this.status = status
    this.code = body.code ?? 'UNKNOWN'
    this.category = body.category ?? 'INTERNAL_ERROR'
    this.retryable = body.retryable ?? false
    this.details = body.details ?? []
    this.correlationId = correlationId
  }

  /** The session must re-prove identity before this action is allowed. */
  get needsRecentAuthentication(): boolean {
    return this.code === 'RECENT_AUTHENTICATION_REQUIRED'
  }

  get isUnauthenticated(): boolean {
    return this.status === 401
  }

  /** Field-level messages keyed by field name, for form display. */
  fieldErrors(): Record<string, string> {
    const errors: Record<string, string> = {}
    for (const detail of this.details) {
      if (detail.field) errors[detail.field] = detail.message
    }
    return errors
  }
}

const TOKEN_KEY = 'bap.admin.token'

export const tokenStore = {
  get: (): string | null => {
    try {
      return globalThis.localStorage?.getItem(TOKEN_KEY) ?? null
    } catch {
      return null
    }
  },
  set: (token: string): void => {
    try {
      globalThis.localStorage?.setItem(TOKEN_KEY, token)
    } catch {
      /* storage unavailable; the session lives for this page only */
    }
  },
  clear: (): void => {
    try {
      globalThis.localStorage?.removeItem(TOKEN_KEY)
    } catch {
      /* nothing to clear */
    }
  },
}

/** Called when the API reports the session is no longer valid. */
let onUnauthenticated: () => void = () => {}

export function setUnauthenticatedHandler(handler: () => void): void {
  onUnauthenticated = handler
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'
  body?: unknown
  /** Skip the automatic sign-out on 401 (used by the login call itself). */
  anonymous?: boolean
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, anonymous = false } = options
  const token = tokenStore.get()

  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(token && !anonymous ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

  if (response.status === 204) return undefined as T

  const text = await response.text()
  const payload: unknown = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const envelope = payload as { error?: Partial<ApiErrorBody>; correlationId?: string; message?: string }
    const error = new ApiError(
      response.status,
      envelope.error ?? { message: envelope.message },
      envelope.correlationId,
    )

    if (error.isUnauthenticated && !anonymous) {
      tokenStore.clear()
      onUnauthenticated()
    }

    throw error
  }

  return (payload as { data: T }).data
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
}
