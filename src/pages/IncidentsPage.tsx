import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { AlertQueue, IncidentDetail, IncidentQueue, IncidentRow } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { Screen } from '../components/layout/Screen'
import { Button, Details, Detail, EmptyState, Loading, Notice, Panel, Stat, Tag } from '../components/ui'

function ago(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (minutes < 1440) return `${Math.round(minutes / 60)}h ago`

  return `${Math.round(minutes / 1440)}d ago`
}

/** What each state means to somebody deciding whether to pick it up. */
const STATUS_LABELS: Record<string, string> = {
  OPEN: 'nobody has looked',
  ACKNOWLEDGED: 'seen',
  INVESTIGATING: 'being worked',
  RESOLVED: 'believed fixed',
  CLOSED: 'closed',
}

const TRANSITION_LABELS: Record<string, string> = {
  ACKNOWLEDGED: 'I have seen this',
  INVESTIGATING: 'I am on it',
  RESOLVED: 'Resolve',
  CLOSED: 'Close',
}

export function IncidentsPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()

  const mayAct = can(Permission.TransactionsResolve)

  const [error, setError] = useState<string | null>(null)
  const [showFinished, setShowFinished] = useState(false)
  const [open, setOpen] = useState<number | null>(null)

  const incidents = useQuery({
    queryKey: ['incidents', { showFinished }],
    queryFn: () =>
      api.envelope<IncidentQueue>(`/admin/incidents${showFinished ? '?includeFinished=1' : ''}`),
    refetchInterval: 60_000,
  })

  const alerts = useQuery({
    queryKey: ['alerts'],
    queryFn: () => api.envelope<AlertQueue>('/admin/alerts'),
    refetchInterval: 60_000,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['incidents'] })
    void queryClient.invalidateQueries({ queryKey: ['alerts'] })
  }

  const move = async (incident: IncidentRow, status: string) => {
    setError(null)

    // Resolving is the one transition that must carry an account of what was
    // done, so it is asked for here rather than refused by the API afterwards.
    const reason =
      status === 'RESOLVED' ? window.prompt('What was done about this?')?.trim() : undefined

    if (status === 'RESOLVED' && !reason) return

    try {
      await api.post(`/admin/incidents/${incident.id}/status`, { status, ...(reason ? { reason } : {}) })
      refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The incident could not be updated.')
    }
  }

  if (incidents.isPending) return <Loading label="Loading incidents" />
  if (incidents.isError) return <Notice>Could not load the incident queue.</Notice>

  const rows = incidents.data.data
  const unacknowledgedAlerts = alerts.data?.meta.unacknowledged ?? 0

  return (
    <Screen
      number="11"
      title="Incidents"
      description="What the platform noticed and told somebody about · PRD §12.20"
      actions={
        <Button variant="secondary" onClick={() => setShowFinished(!showFinished)}>
          {showFinished ? 'Show open' : 'Include closed'}
        </Button>
      }
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}

        {incidents.data.meta.critical > 0 && (
          <Notice title={`${incidents.data.meta.critical} critical`}>
            Money or delivery is affected now. These are ordered above everything else in the queue.
          </Notice>
        )}

        <div className="grid-3">
          <Stat value={incidents.data.meta.open} label="Open incidents" />
          <Stat value={incidents.data.meta.critical} label="Critical" />
          <Stat value={unacknowledgedAlerts} label="Unacknowledged alerts" />
        </div>

        <Panel
          title="Queue"
          subtitle="Still burning, worst first — not most recent first"
          flush
        >
          {rows.length === 0 ? (
            <EmptyState title={showFinished ? 'Nothing recorded yet' : 'Nothing open'}>
              {/*
                Said plainly: an empty queue means alert evaluation found nothing,
                which is only reassuring if it has actually been running.
              */}
              Alert evaluation runs every five minutes. An empty queue means the last run found nothing wrong.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Incident</th>
                    <th>State</th>
                    <th>Alerts</th>
                    <th>Last seen</th>
                    {mayAct && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((incident) => (
                    <IncidentLine
                      key={incident.id}
                      incident={incident}
                      mayAct={mayAct}
                      expanded={open === incident.id}
                      onToggle={() => setOpen(open === incident.id ? null : incident.id)}
                      onMove={(status) => void move(incident, status)}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="panel__subtitle">
          Alert rules and their cooldowns are configuration. <Link to="/audit-logs">Every acknowledgement is audited →</Link>
        </p>
      </div>
    </Screen>
  )
}

function IncidentLine({
  incident,
  mayAct,
  expanded,
  onToggle,
  onMove,
}: {
  incident: IncidentRow
  mayAct: boolean
  expanded: boolean
  onToggle: () => void
  onMove: (status: string) => void
}) {
  const detail = useQuery({
    queryKey: ['incident', incident.id],
    queryFn: () => api.get<IncidentDetail>(`/admin/incidents/${incident.id}`),
    enabled: expanded,
  })

  return (
    <>
      <tr>
        <td>
          <Button variant="ghost" onClick={onToggle}>
            {incident.label}
          </Button>
          <div className="panel__subtitle">
            {incident.subject} · {incident.summary}
          </div>
        </td>
        <td>
          <Tag tone={incident.severity === 'CRITICAL' ? 'accent' : 'neutral'}>
            {incident.severity.toLowerCase()}
          </Tag>
          <div className="panel__subtitle">{STATUS_LABELS[incident.status] ?? incident.status}</div>
        </td>
        <td className="mono">{incident.alertCount}</td>
        <td className="panel__subtitle">{ago(incident.lastAlertAt)}</td>
        {mayAct && (
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            {/*
              Only what the state machine will accept. A button that then refuses
              is worse than no button.
            */}
            {incident.allowedTransitions.map((status) => (
              <span key={status}>
                <Button variant="secondary" onClick={() => onMove(status)}>
                  {TRANSITION_LABELS[status] ?? status.toLowerCase()}
                </Button>{' '}
              </span>
            ))}
          </td>
        )}
      </tr>

      {incident.resolutionReason && (
        <tr>
          <td colSpan={mayAct ? 5 : 4} className="panel__subtitle">
            Resolved by {incident.resolvedBy ?? 'unknown'}: {incident.resolutionReason}
          </td>
        </tr>
      )}

      {expanded && (
        <tr>
          <td colSpan={mayAct ? 5 : 4}>
            {detail.isPending ? (
              <Loading label="Loading the incident" />
            ) : detail.isError || !detail.data ? (
              <Notice>Could not load this incident.</Notice>
            ) : (
              <div className="stack">
                <Details>
                  <Detail label="Opened">{new Date(detail.data.openedAt).toLocaleString()}</Detail>
                  <Detail label="Seen by">{detail.data.acknowledgedBy ?? '—'}</Detail>
                  <Detail label="Alerts">{detail.data.alertCount}</Detail>
                </Details>

                {detail.data.transactions.length > 0 && (
                  <div>
                    <strong>Transactions</strong>
                    <ul>
                      {detail.data.transactions.map((t) => (
                        <li key={t.transactionReference}>
                          <Link to={`/transactions/${t.transactionReference}`}>{t.clientReference}</Link> · {t.status}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Alert</th>
                        <th>Seen</th>
                        <th>When</th>
                        <th>Told anybody?</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detail.data.alerts.map((alert) => (
                        <tr key={alert.id}>
                          <td className="panel__subtitle">{alert.summary}</td>
                          <td className="mono">{alert.occurrences}×</td>
                          <td className="panel__subtitle">{ago(alert.lastSeenAt)}</td>
                          <td>
                            {/*
                              Raised and arrived are different facts. An alert
                              nobody received is a different situation from one
                              that was ignored.
                            */}
                            {alert.delivered ? <Tag tone="outline">delivered</Tag> : <Tag>never delivered</Tag>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </td>
        </tr>
      )}
    </>
  )
}
