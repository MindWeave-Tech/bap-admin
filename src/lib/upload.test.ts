import { afterEach, describe, expect, it, vi } from 'vitest'
import { api, ApiError, setUnauthenticatedHandler, tokenStore } from './api'

function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })
}

afterEach(() => {
  vi.restoreAllMocks()
  tokenStore.clear()
  setUnauthenticatedHandler(() => {})
})

/**
 * TASK-1505 — the three request shapes the reconciliation screen needs that
 * plain JSON requests do not cover.
 */
describe('upload', () => {
  it('leaves Content-Type unset so the browser writes the multipart boundary', async () => {
    const fetchMock = vi.fn().mockResolvedValue(respond(201, { data: { acceptedCount: 2 } }))
    vi.stubGlobal('fetch', fetchMock)
    tokenStore.set('session-token')

    const form = new FormData()
    form.append('statement', new File(['a,b\n1,2'], 'july.csv', { type: 'text/csv' }))

    await expect(api.upload('/admin/reconciliation/batches/1/imports', form)).resolves.toEqual({ acceptedCount: 2 })

    const headers = fetchMock.mock.calls[0][1].headers as Record<string, string>

    // Setting it by hand produces a body the server cannot split.
    expect(headers['Content-Type']).toBeUndefined()
    expect(headers.Authorization).toBe('Bearer session-token')
  })

  it('surfaces a rejected import as a typed error rather than a silent failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        respond(422, { error: { code: 'STATEMENT_IMPORT_FAILED', message: 'The file has a heading row and nothing else.' } }),
      ),
    )

    await expect(api.upload('/admin/reconciliation/batches/1/imports', new FormData())).rejects.toMatchObject({
      code: 'STATEMENT_IMPORT_FAILED',
    })
  })
})

describe('envelope', () => {
  it('keeps the pagination meta that the data unwrapper drops', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { data: [{ id: 1 }], meta: { total: 9 } })))

    // The queue headline counts every outstanding finding, not just the page.
    await expect(api.envelope<{ data: unknown[]; meta: { total: number } }>('/admin/x')).resolves.toEqual({
      data: [{ id: 1 }],
      meta: { total: 9 },
    })
  })
})

describe('download', () => {
  it('reports a refusal as a message instead of saving a file of JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(respond(422, { error: { code: 'BATCH_NOT_MATCHED', message: 'Not compared yet.' } })),
    )

    // A corrupt file landing in the operator's downloads is worse than an
    // error they can read.
    await expect(api.download('/admin/reconciliation/batches/1/export', 'x.csv')).rejects.toBeInstanceOf(ApiError)
  })
})
