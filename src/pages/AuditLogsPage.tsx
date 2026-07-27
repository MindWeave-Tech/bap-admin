import { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { AuditLogEntry } from '../lib/types'
import { Screen } from '../components/layout/Screen'
import { Button, Dialog, EmptyState, Loading, Notice, Panel, Tag } from '../components/ui'

export function AuditLogsPage() {
  const [action, setAction] = useState('')
  const [actor, setActor] = useState('')
  const [applied, setApplied] = useState({ action: '', actor: '' })
  const [page, setPage] = useState(1)
  const [inspecting, setInspecting] = useState<AuditLogEntry | null>(null)

  const query = useQuery({
    queryKey: ['audit-logs', applied, page],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), perPage: '50' })
      if (applied.action) params.set('action', applied.action)
      if (applied.actor) params.set('actor', applied.actor)

      return api.get<AuditLogEntry[]>(`/admin/audit-logs?${params}`)
    },
    placeholderData: keepPreviousData,
  })

  return (
    <Screen
      number="11"
      title="Audit logs"
      description="Immutable record of every security and administrative action. Entries are written on insert only and never contain secrets."
    >
      <div className="stack">
        <Panel>
          <form
            className="row"
            style={{ alignItems: 'flex-end', gap: 'var(--space-3)' }}
            onSubmit={(event) => {
              event.preventDefault()
              setPage(1)
              setApplied({ action: action.trim(), actor: actor.trim() })
            }}
          >
            <div className="field" style={{ flex: '1 1 260px' }}>
              <label htmlFor="audit-action">Action</label>
              <input
                id="audit-action"
                className="input"
                value={action}
                placeholder="auth. · transaction. · api_credential."
                onChange={(event) => setAction(event.target.value)}
              />
            </div>
            <div className="field" style={{ flex: '1 1 220px' }}>
              <label htmlFor="audit-actor">Actor</label>
              <input
                id="audit-actor"
                className="input"
                value={actor}
                placeholder="email"
                onChange={(event) => setActor(event.target.value)}
              />
            </div>
            <Button type="submit">Filter</Button>
          </form>
        </Panel>

        <Panel flush>
          {query.isPending ? (
            <Loading label="Loading audit trail" />
          ) : query.isError ? (
            <div className="panel__body">
              <Notice>Could not load the audit trail.</Notice>
            </div>
          ) : query.data.length === 0 ? (
            <EmptyState title="No audit entries match" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Timestamp</th>
                    <th>Action</th>
                    <th>Actor</th>
                    <th>Resource</th>
                    <th>Reason</th>
                    <th aria-label="Detail" />
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((entry) => (
                    <tr key={entry.id}>
                      <td className="panel__subtitle">{new Date(entry.at).toLocaleString()}</td>
                      <td className="mono">{entry.action}</td>
                      <td>
                        <div>{entry.actorLabel ?? 'System'}</div>
                        <div className="panel__subtitle">{entry.ipAddress ?? '—'}</div>
                      </td>
                      <td>
                        {entry.resourceType ? (
                          <>
                            <div>{entry.resourceType}</div>
                            <div className="panel__subtitle mono">{entry.resourceId}</div>
                          </>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="panel__subtitle">{entry.reason ?? '—'}</td>
                      <td>
                        {(entry.beforeState || entry.afterState) && (
                          <Button variant="ghost" onClick={() => setInspecting(entry)}>
                            State
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        {query.data && query.data.length > 0 && (
          <div className="row-between">
            <span className="panel__subtitle">Page {page}</span>
            <div className="row">
              <Button variant="secondary" disabled={page === 1} onClick={() => setPage((value) => value - 1)}>
                Previous
              </Button>
              <Button
                variant="secondary"
                disabled={query.data.length < 50}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>

      {inspecting && (
        <Dialog
          title={inspecting.action}
          onClose={() => setInspecting(null)}
          footer={<Button onClick={() => setInspecting(null)}>Close</Button>}
        >
          <div className="row">
            <Tag>{inspecting.actorType}</Tag>
            {inspecting.correlationId && <Tag tone="outline">{inspecting.correlationId}</Tag>}
          </div>
          {inspecting.beforeState && (
            <div>
              <div className="eyebrow">Before</div>
              <code className="secret">{JSON.stringify(inspecting.beforeState, null, 2)}</code>
            </div>
          )}
          {inspecting.afterState && (
            <div>
              <div className="eyebrow">After</div>
              <code className="secret">{JSON.stringify(inspecting.afterState, null, 2)}</code>
            </div>
          )}
        </Dialog>
      )}
    </Screen>
  )
}
