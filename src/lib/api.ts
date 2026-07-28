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

/** Turn a failed response into the typed error, or return the parsed body. */
async function unwrap(response: Response): Promise<unknown> {
  const text = await response.text()
  const payload: unknown = text ? JSON.parse(text) : {}

  if (!response.ok) {
    const envelope = payload as { error?: Partial<ApiErrorBody>; correlationId?: string; message?: string }
    const error = new ApiError(response.status, envelope.error ?? { message: envelope.message }, envelope.correlationId)

    if (error.isUnauthenticated) {
      tokenStore.clear()
      onUnauthenticated()
    }

    throw error
  }

  return payload
}

function authHeaders(): Record<string, string> {
  const token = tokenStore.get()

  return { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }
}

/**
 * The whole envelope rather than just `data` — for endpoints that return
 * pagination alongside it.
 */
async function requestEnvelope<T>(path: string): Promise<T> {
  return (await unwrap(await fetch(`${config.apiBaseUrl}${path}`, { headers: authHeaders() }))) as T
}

/**
 * Multipart upload. Content-Type is deliberately left unset so the browser
 * writes the boundary itself; setting it by hand produces a body the server
 * cannot split.
 */
async function upload<T>(path: string, form: FormData): Promise<T> {
  const payload = await unwrap(
    await fetch(`${config.apiBaseUrl}${path}`, { method: 'POST', headers: authHeaders(), body: form }),
  )

  return (payload as { data: T }).data
}

/**
 * Fetch a file and hand it to the browser.
 *
 * Not a plain link: the download needs the bearer token, which an anchor
 * cannot carry. An error still arrives as JSON, so a refusal reads as a
 * message rather than a corrupt file landing in the operator's downloads.
 */
async function download(path: string, fallbackName: string): Promise<void> {
  const response = await fetch(`${config.apiBaseUrl}${path}`, { headers: authHeaders() })

  if (!response.ok) {
    await unwrap(response)

    return
  }

  const disposition = response.headers.get('Content-Disposition') ?? ''
  const named = /filename="([^"]+)"/.exec(disposition)
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)

  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = named?.[1] ?? fallbackName
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  envelope: requestEnvelope,
  post: <T>(path: string, body?: unknown, options: RequestOptions = {}) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', body }),
  upload,
  download,
}
