import { useState } from 'react'
import { Link } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { BalanceRegister, BalanceRegisterRow, BalanceSnapshot } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { useConfirmedAction } from '../lib/useConfirmedAction'
import { Screen } from '../components/layout/Screen'
import { Button, EmptyState, Loading, Notice, Panel, Stat, Tag } from '../components/ui'

function naira(minor: number): string {
  return `₦${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function age(iso: string): string {
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60_000)

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`

  return `${Math.round(minutes / 60)}h ago`
}

export function BalancesPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)

  const mayManage = can(Permission.ProvidersToggle)

  const query = useQuery({
    queryKey: ['provider-balances'],
    queryFn: () => api.get<BalanceRegister>('/admin/providers/balances'),
    refetchInterval: 120_000,
  })

  const decide = async (snapshot: BalanceSnapshot, decision: 'approve' | 'reject') => {
    setError(null)

    const reason =
      decision === 'reject'
        ? window.prompt('Why is this balance being rejected?')?.trim()
        : undefined

    if (decision === 'reject' && !reason) return

    try {
      await run(() =>
        api.post(`/admin/providers/balances/${snapshot.id}/${decision}`, decision === 'reject' ? { reason } : {}),
      )
      void queryClient.invalidateQueries({ queryKey: ['provider-balances'] })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The decision could not be recorded.')
    }
  }

  if (query.isPending) return <Loading label="Loading balances" />
  if (query.isError) return <Notice>Could not load the balance register.</Notice>

  const { register, awaitingApproval } = query.data
  const alerting = register.filter((row) => row.alertLevel !== null)
  const unmonitored = register.filter((row) => row.balance === null)

  return (
    <Screen
      number="09"
      title="Provider balances"
      description="Provider wallets fund every vend. One that runs dry rejects them all while looking healthy · PRD §12.17"
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}

        {alerting.length > 0 && (
          <Notice title={`${alerting.length} provider${alerting.length === 1 ? '' : 's'} below threshold`}>
            {alerting.map((row) => `${row.providerCode} (${row.alertLevel?.toLowerCase()})`).join(', ')}. A provider
            that cannot cover a vend is excluded from routing until it is funded.
          </Notice>
        )}

        {awaitingApproval.length > 0 && (
          <Panel
            title="Awaiting a second pair of eyes"
            subtitle="A manually entered balance is a proposal until somebody else confirms it"
            flush
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Proposed</th>
                    <th>Entered by</th>
                    <th>Note</th>
                    {mayManage && <th />}
                  </tr>
                </thead>
                <tbody>
                  {awaitingApproval.map((snapshot) => (
                    <tr key={snapshot.id}>
                      <td>{snapshot.providerCode}</td>
                      <td className="mono">{naira(snapshot.availableMinor)}</td>
                      <td className="panel__subtitle">
                        {snapshot.recordedBy ?? '—'}
                        <div>{age(snapshot.takenAt)}</div>
                      </td>
                      <td className="panel__subtitle">{snapshot.note ?? '—'}</td>
                      {mayManage && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Button variant="secondary" onClick={() => void decide(snapshot, 'reject')}>
                            Reject
                          </Button>{' '}
                          <Button onClick={() => void decide(snapshot, 'approve')}>Approve</Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

        <div className="grid-3">
          <Stat value={register.length} label="Providers" />
          <Stat value={alerting.length} label="Below threshold" />
          <Stat value={unmonitored.length} label="No reading" />
        </div>

        <Panel title="Register" subtitle="Latest reading per provider, with where it came from and how old it is" flush>
          {register.length === 0 ? (
            <EmptyState title="No providers configured" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th style={{ textAlign: 'right' }}>Available</th>
                    <th>Reading</th>
                    <th style={{ textAlign: 'right' }}>Est. vends</th>
                    <th>Thresholds</th>
                  </tr>
                </thead>
                <tbody>
                  {register.map((row) => (
                    <Row key={row.providerCode} row={row} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="panel__subtitle">
          Thresholds and manual entry live on each provider. <Link to="/providers">Open the provider register →</Link>
        </p>
      </div>

      {confirmDialog}
    </Screen>
  )
}

function Row({ row }: { row: BalanceRegisterRow }) {
  return (
    <tr>
      <td>
        <div>{row.providerCode}</div>
        <div className="panel__subtitle">{row.environment}</div>
      </td>
      <td className="mono" style={{ textAlign: 'right' }}>
        {row.balance === null ? '—' : naira(row.balance.availableMinor)}
        {row.alertLevel !== null && (
          <div>
            <Tag tone="accent">{row.alertLevel.toLowerCase()}</Tag>
          </div>
        )}
      </td>
      <td className="panel__subtitle">
        {row.balance === null ? (
          // Never polled, and said so. An absent reading is not a zero balance,
          // and routing treats it as unknown rather than as empty.
          <Tag>never read</Tag>
        ) : (
          <>
            <Tag tone="outline">{row.balance.source.toLowerCase()}</Tag> {age(row.balance.takenAt)}
            {row.stale && (
              <div>
                <Tag>too old to act on</Tag>
              </div>
            )}
          </>
        )}
      </td>
      <td className="mono" style={{ textAlign: 'right' }}>
        {row.estimatedVends ?? '—'}
      </td>
      <td className="panel__subtitle">
        {row.thresholds.warningMinor === null && row.thresholds.criticalMinor === null ? (
          // No alarm is not an all-clear, and the register says which it is.
          <Tag>none set</Tag>
        ) : (
          <>
            {row.thresholds.warningMinor !== null && <div>warn {naira(row.thresholds.warningMinor)}</div>}
            {row.thresholds.criticalMinor !== null && <div>critical {naira(row.thresholds.criticalMinor)}</div>}
          </>
        )}
      </td>
    </tr>
  )
}
