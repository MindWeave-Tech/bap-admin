import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { CallbackRow } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { useConfirmedAction } from '../lib/useConfirmedAction'
import { Screen } from '../components/layout/Screen'
import { Button, EmptyState, Loading, Notice, Panel, Tag } from '../components/ui'

export function CallbacksPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)
  const [showDelivered, setShowDelivered] = useState(false)

  const mayRetry = can(Permission.WebhooksRetry)

  const query = useQuery({
    queryKey: ['callbacks', showDelivered],
    queryFn: () => api.get<CallbackRow[]>(`/admin/callbacks${showDelivered ? '?status=DELIVERED' : ''}`),
  })

  const retry = async (callback: CallbackRow) => {
    setError(null)

    try {
      await run(() => api.post(`/admin/callbacks/${callback.id}/retry`, {}))
      void queryClient.invalidateQueries({ queryKey: ['callbacks'] })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The retry could not be queued.')
    }
  }

  if (query.isPending) return <Loading label="Loading callbacks" />
  if (query.isError) return <Notice>Could not load the callback queue.</Notice>

  const rows = query.data
  const exhausted = rows.filter((row) => row.status === 'EXHAUSTED').length

  return (
    <Screen
      number="08"
      title="Client callbacks"
      description="Events the platform owes its clients, and the ones that never arrived · PRD §14.6"
      actions={
        <Button variant="secondary" onClick={() => setShowDelivered(!showDelivered)}>
          {showDelivered ? 'Show failing' : 'Show delivered'}
        </Button>
      }
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}

        {exhausted > 0 && !showDelivered && (
          <Notice title={`${exhausted} callback${exhausted === 1 ? '' : 's'} gave up`}>
            These transactions settled correctly, but the client was never told. Retrying re-sends the event; it does
            not change what the transaction did.
          </Notice>
        )}

        <Panel
          title={showDelivered ? 'Delivered' : 'Failing delivery'}
          subtitle={showDelivered ? 'Events the client acknowledged' : 'Retrying resolves itself; exhausted does not'}
          flush
        >
          {rows.length === 0 ? (
            <EmptyState title={showDelivered ? 'Nothing delivered yet' : 'Every callback has been delivered'}>
              {showDelivered ? undefined : 'No client is waiting on an event.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Event</th>
                    <th>Transaction</th>
                    <th style={{ textAlign: 'right' }}>Attempts</th>
                    <th>Last error</th>
                    {mayRetry && !showDelivered && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={row.id}>
                      <td>
                        <div>{row.apiClient.name ?? '—'}</div>
                        <div className="panel__subtitle mono">{row.callbackUrl}</div>
                      </td>
                      <td>
                        <div className="mono">{row.eventType}</div>
                        <div className="panel__subtitle">
                          {row.status === 'EXHAUSTED' ? (
                            <Tag tone="accent">gave up</Tag>
                          ) : row.status === 'DELIVERED' ? (
                            <Tag tone="outline">delivered</Tag>
                          ) : (
                            <Tag>{row.status.toLowerCase()}</Tag>
                          )}
                        </div>
                      </td>
                      <td>
                        {row.transactionReference ? (
                          <Link className="mono" to={`/transactions/${row.transactionReference}`}>
                            {row.transactionReference}
                          </Link>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{row.attempts}</td>
                      <td className="panel__subtitle">
                        {row.lastResponseStatus !== null && <span className="mono">{row.lastResponseStatus} </span>}
                        {row.lastError ?? '—'}
                      </td>
                      {mayRetry && !showDelivered && (
                        <td style={{ textAlign: 'right' }}>
                          <Button variant="secondary" onClick={() => void retry(row)}>
                            Retry
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {confirmDialog}
    </Screen>
  )
}
