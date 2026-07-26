import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError, request, setUnauthenticatedHandler, tokenStore } from './api'

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.clear()
  setUnauthenticatedHandler(() => {})
})

describe('request', () => {
  it('unwraps the data envelope', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { data: { id: 7 } })))

    await expect(request<{ id: number }>('/admin/users')).resolves.toEqual({ id: 7 })
  })

  it('attaches the stored bearer token', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { data: null }))
    vi.stubGlobal('fetch', fetchMock)
    tokenStore.set('session-token')

    await request('/admin/auth/me')

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBe('Bearer session-token')
  })

  it('omits the token for anonymous calls', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(200, { data: null }))
    vi.stubGlobal('fetch', fetchMock)
    tokenStore.set('session-token')

    await request('/admin/auth/login', { method: 'POST', body: {}, anonymous: true })

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>
    expect(headers.Authorization).toBeUndefined()
  })

  it('parses the platform error envelope into a typed error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond(422, {
          error: {
            code: 'VALIDATION_FAILED',
            message: 'The request is invalid.',
            category: 'VALIDATION_ERROR',
            retryable: false,
            details: [{ field: 'email', message: 'The email is required.' }],
          },
          correlationId: 'cor_123',
        }),
      ),
    )

    const error = await request('/admin/users', { method: 'POST', body: {} }).catch((caught: unknown) => caught)

    expect(error).toBeInstanceOf(ApiError)
    const apiError = error as ApiError
    expect(apiError.code).toBe('VALIDATION_FAILED')
    expect(apiError.correlationId).toBe('cor_123')
    expect(apiError.fieldErrors()).toEqual({ email: 'The email is required.' })
  })

  it('flags a sensitive action that needs recent authentication', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond(403, {
          error: {
            code: 'RECENT_AUTHENTICATION_REQUIRED',
            message: 'Confirm your password to continue.',
            category: 'AUTHORIZATION_ERROR',
            retryable: false,
          },
        }),
      ),
    )

    const error = (await request('/admin/api-clients/1/credentials', { method: 'POST' }).catch(
      (caught: unknown) => caught,
    )) as ApiError

    expect(error.needsRecentAuthentication).toBe(true)
    expect(error.isUnauthenticated).toBe(false)
  })

  it('clears the session and notifies on 401', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(401, { error: { code: 'UNAUTHENTICATED', message: 'Expired.' } })),
    )
    tokenStore.set('stale-token')

    const onUnauthenticated = vi.fn()
    setUnauthenticatedHandler(onUnauthenticated)

    await expect(request('/admin/auth/me')).rejects.toBeInstanceOf(ApiError)
    expect(tokenStore.get()).toBeNull()
    expect(onUnauthenticated).toHaveBeenCalledOnce()
  })
})
