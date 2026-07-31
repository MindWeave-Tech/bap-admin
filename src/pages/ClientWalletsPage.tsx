import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ClientWalletRow } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { useConfirmedAction } from '../lib/useConfirmedAction'
import { Screen } from '../components/layout/Screen'
import { Button, EmptyState, Loading, Notice, Panel, Stat, Tag } from '../components/ui'

function naira(minor: number): string {
  const sign = minor < 0 ? '-' : ''

  return `${sign}₦${Math.abs(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/**
 * A wallet's mode is the difference between an overdrawn client that keeps
 * serving customers and one that stops, so it is shown as a tag rather than
 * buried in a detail page.
 */
function modeTone(mode: string): 'neutral' | 'accent' | 'outline' {
  // ENFORCE is the one that can stop a client vending, so it is the one that
  // stands out. OVERDRAFT is the internal-client default and unremarkable.
  if (mode === 'ENFORCE') return 'accent'

  return 'outline'
}

export function ClientWalletsPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)

  const mayFund = can(Permission.ClientWalletsFund)
  const mayApprove = can(Permission.ClientWalletsApprove)

  const query = useQuery({
    queryKey: ['client-wallets'],
    queryFn: () => api.get<{ data: ClientWalletRow[] }>('/admin/client-wallets'),
    refetchInterval: 120_000,
  })

  const requestFunding = async (wallet: ClientWalletRow) => {
    setError(null)

    const amount = window.prompt(`How much to add to ${wallet.clientCode}, in naira?`)?.trim()
    if (!amount) return

    const reference = window.prompt('Finance reference for this allocation?')?.trim()
    if (!reference) return

    const reason = window.prompt('Why?')?.trim()
    if (!reason) return

    const minor = Math.round(Number(amount) * 100)

    if (!Number.isFinite(minor) || minor === 0) {
      setError('That amount could not be read as a number of naira.')
      return
    }

    try {
      await run(() =>
        api.post(`/admin/client-wallets/${wallet.clientId}/fundings`, {
          amountMinor: minor,
          reference,
          reason,
        }),
      )
      void queryClient.invalidateQueries({ queryKey: ['client-wallets'] })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The funding could not be requested.')
    }
  }

  if (query.isPending) return <Loading label="Loading client wallets" />
  if (query.isError) return <Notice>Could not load client wallets.</Notice>

  const wallets = query.data.data
  const overdrawn = wallets.filter((w) => w.isOverdrawn)
  const unreconciled = wallets.filter((w) => w.balanceReconciledAt === null)

  return (
    <Screen
      number="15"
      title="Client wallets"
      description="What each internal service has been allocated, and what it has spent · ADR-019"
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}

        {overdrawn.length > 0 && (
          <Notice title={`${overdrawn.length} client${overdrawn.length === 1 ? '' : 's'} overdrawn`}>
            {overdrawn.map((w) => w.clientCode).join(', ')}. In overdraft mode these keep vending — the balance is a
            conversation about allocation, not an outage. A client in <strong>enforce</strong> mode would be refused.
          </Notice>
        )}

        {unreconciled.length > 0 && (
          <Notice title="Balances not yet reconciled">
            {unreconciled.length} wallet{unreconciled.length === 1 ? ' has' : 's have'} no successful reconciliation
            against their own entries. The entries are the authority; a cached balance nobody has checked is a number,
            not a fact.
          </Notice>
        )}

        <div className="grid-3">
          <Stat value={wallets.length} label="Wallets" />
          <Stat value={overdrawn.length} label="Overdrawn" />
          <Stat
            value={naira(wallets.reduce((total, w) => total + w.reservedMinor, 0))}
            label="Held against vends in flight"
          />
        </div>

        <Panel
          title="Wallets"
          subtitle="Reserved money is held against transactions that have not resolved — including any sitting at UNKNOWN"
          flush
        >
          {wallets.length === 0 ? (
            <EmptyState title="No wallets yet">
              A wallet is created the first time a client vends, or the first time one is funded.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Mode</th>
                    <th style={{ textAlign: 'right' }}>Available</th>
                    <th style={{ textAlign: 'right' }}>Reserved</th>
                    <th style={{ textAlign: 'right' }}>Overdraft limit</th>
                    {mayFund && <th />}
                  </tr>
                </thead>
                <tbody>
                  {wallets.map((wallet) => (
                    <tr key={wallet.id}>
                      <td>
                        <strong>{wallet.clientCode}</strong>
                        <div className="panel__subtitle">{wallet.clientName}</div>
                      </td>
                      <td>
                        <Tag tone={modeTone(wallet.enforcementMode)}>{wallet.enforcementMode}</Tag>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {wallet.isOverdrawn ? (
                          <strong>{naira(wallet.availableMinor)}</strong>
                        ) : (
                          naira(wallet.availableMinor)
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {naira(wallet.reservedMinor)}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {wallet.enforcementMode === 'OVERDRAFT' ? naira(wallet.overdraftLimitMinor) : '—'}
                      </td>
                      {mayFund && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <Button variant="secondary" onClick={() => void requestFunding(wallet)}>
                            Request funding
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

        {mayFund && !mayApprove && (
          <Notice title="You can request funding, not approve it">
            A funding request moves no money. Somebody else has to approve it, and the person who requested it cannot
            be that person — which is the whole of the control.
          </Notice>
        )}
      </div>

      {confirmDialog}
    </Screen>
  )
}
