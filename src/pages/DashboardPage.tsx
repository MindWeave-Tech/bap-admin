import { Link } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Overview } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { Screen } from '../components/layout/Screen'
import { EmptyState, Loading, Notice, Panel, Stat, Tag } from '../components/ui'

/** Bucket edges arrive in minutes; these are what an operator reads. */
const BUCKET_LABELS: Record<string, string> = {
  '5': 'under 5m',
  '30': '5–30m',
  '120': '30m–2h',
  '360': '2–6h',
  '1440': '6–24h',
  older: 'over 24h',
}

const STATUS_LABELS: Record<string, string> = {
  PENDING_PROVIDER: 'Pending at provider',
  UNKNOWN: 'Outcome unknown',
  MANUAL_REVIEW: 'Manual review',
}

function naira(minor: number): string {
  return `₦${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 0 })}`
}

export function DashboardPage() {
  const { user, can } = useAuth()
  const mayView = can(Permission.TransactionsView)

  const query = useQuery({
    queryKey: ['overview'],
    queryFn: () => api.get<Overview>('/admin/overview'),
    enabled: mayView,

    // This is the screen people leave open. A stale count that looks
    // authoritative is worse than a moment's loading.
    refetchInterval: 60_000,
  })

  if (!mayView) {
    return (
      <Screen number="01" title={`Welcome, ${user?.name.split(' ')[0] ?? 'operator'}`}>
        <EmptyState title="No operational data for this role">
          Your role does not include transaction visibility, so there is nothing to summarise here. The screens you can
          reach are in the sidebar.
        </EmptyState>
      </Screen>
    )
  }

  if (query.isPending) return <Loading label="Loading overview" />
  if (query.isError) return <Notice>Could not load the overview.</Notice>

  const { outcomes, aging, queue, approvals, reconciliation } = query.data
  const overdue = aging.beyondManualReviewBoundary
  const buckets = [...aging.bucketMinutes.map(String), 'older']

  const settled = outcomes.counts.SUCCESS ?? 0
  const successRate = outcomes.total === 0 ? null : Math.round((settled / outcomes.total) * 100)

  return (
    <Screen
      number="01"
      title={`Welcome, ${user?.name.split(' ')[0] ?? 'operator'}`}
      description={`Last 7 days · ${outcomes.total.toLocaleString()} transactions`}
    >
      <div className="stack">
        {overdue > 0 && (
          <Notice title={`${overdue} transaction${overdue === 1 ? '' : 's'} past the 24-hour boundary`}>
            Nothing resolves these automatically, and each is holding a customer's funds in reservation until an
            operator settles it. <Link to="/manual-review">Open manual review →</Link>
          </Notice>
        )}

        <div className="grid-3">
          <Stat value={successRate === null ? '—' : `${successRate}%`} label="Settled successfully" />
          <Stat value={naira(outcomes.deliveredValueMinor)} label="Value delivered" />
          <Stat value={overdue} label="Past 24h boundary" />
        </div>

        <div className="grid-2">
          <Panel title="Outcomes" subtitle="Every transaction in the range, by where it ended up" flush>
            {outcomes.total === 0 ? (
              <EmptyState title="No transactions in this range" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Status</th>
                      <th style={{ textAlign: 'right' }}>Count</th>
                      <th style={{ textAlign: 'right' }}>Share</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(outcomes.counts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([status, count]) => (
                        <tr key={status}>
                          <td>{status.replaceAll('_', ' ').toLowerCase()}</td>
                          <td className="mono" style={{ textAlign: 'right' }}>
                            {count.toLocaleString()}
                          </td>
                          <td className="panel__subtitle" style={{ textAlign: 'right' }}>
                            {Math.round((count / outcomes.total) * 100)}%
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel
            title="Unresolved, by age"
            subtitle="Funds stay reserved until each of these settles · PRD §12.15"
            flush
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>State</th>
                    {buckets.map((bucket) => (
                      <th key={bucket} style={{ textAlign: 'right' }}>
                        {BUCKET_LABELS[bucket] ?? bucket}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(aging.byStatus).map(([status, counts]) => (
                    <tr key={status}>
                      <td>{STATUS_LABELS[status] ?? status}</td>
                      {buckets.map((bucket) => {
                        const count = counts[bucket] ?? 0

                        return (
                          <td
                            key={bucket}
                            className="mono"
                            style={{ textAlign: 'right', opacity: count === 0 ? 0.35 : 1 }}
                          >
                            {bucket === 'older' && count > 0 ? <Tag tone="accent">{count}</Tag> : count}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>

        <div className="grid-3">
          <Panel title="Queue" subtitle="Work waiting on us, rather than on a provider">
            <div className="grid-2">
              <Stat value={queue.queued} label="Queued" />
              <Stat value={queue.vending} label="Vending" />
            </div>
            <p className="panel__subtitle" style={{ marginTop: 'var(--space-3)' }}>
              {queue.depth === null
                ? 'Job queue depth is unavailable — the queue could not be reached, which is not the same as it being empty.'
                : `${queue.depth} job${queue.depth === 1 ? '' : 's'} waiting on the vending queue.`}
            </p>
          </Panel>

          <Panel title="Awaiting approval" subtitle="Changes that need a second pair of eyes">
            <Stat value={approvals.routingChangeRequests} label="Routing change requests" />
            {approvals.routingChangeRequests > 0 && can(Permission.RoutingView) && (
              <p className="panel__subtitle" style={{ marginTop: 'var(--space-3)' }}>
                <Link to="/routing">Review them →</Link>
              </p>
            )}
          </Panel>

          <Panel title="Reconciliation" subtitle="Settlement against provider records">
            {reconciliation.varianceAvailable ? (
              <Stat value={naira(reconciliation.varianceMinor ?? 0)} label="Variance" />
            ) : (
              <>
                <Tag>not yet measured</Tag>
                <p className="panel__subtitle" style={{ marginTop: 'var(--space-3)' }}>
                  Reconciliation arrives with its own epic. No variance is shown until then, because a zero here would
                  claim the books balance when nothing has checked them.
                </p>
              </>
            )}
          </Panel>
        </div>
      </div>
    </Screen>
  )
}
