import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ClientWalletList, ClientWalletRow, PendingClientWalletFunding } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { useConfirmedAction } from '../lib/useConfirmedAction'
import { Screen } from '../components/layout/Screen'
import {
  Button,
  Detail,
  Details,
  Dialog,
  EmptyState,
  Field,
  Loading,
  Notice,
  Panel,
  Select,
  Stat,
  Tag,
} from '../components/ui'

function naira(minor: number): string {
  const sign = minor < 0 ? '-' : ''

  return `${sign}₦${Math.abs(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/**
 * Naira as typed by a person — "250,000" or "1500.50" — to minor units.
 * Null for anything that is not a positive amount with at most two decimals,
 * rather than a best guess: a misread amount here becomes a ledger entry.
 */
function parseNaira(text: string): number | null {
  const cleaned = text.replace(/[,\s₦]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  const minor = Math.round(Number(cleaned) * 100)

  return minor > 0 ? minor : null
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

/** Anything that can be funded: a client with a wallet, or one about to get its first. */
interface FundableClient {
  clientId: number
  clientCode: string
  clientName: string
  wallet: ClientWalletRow | null
}

type Run = <T>(action: () => Promise<T>) => Promise<T | undefined>

export function ClientWalletsPage() {
  const { can, user } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  // `undefined` is closed; `null` is open with no client chosen yet.
  const [fundingFor, setFundingFor] = useState<number | null | undefined>(undefined)
  const [reviewing, setReviewing] = useState<PendingClientWalletFunding | null>(null)
  const [outcome, setOutcome] = useState<{ title: string; body: string } | null>(null)

  const mayFund = can(Permission.ClientWalletsFund)
  const mayApprove = can(Permission.ClientWalletsApprove)
  const mayAdjust = can(Permission.ClientWalletsAdjust)

  const query = useQuery({
    queryKey: ['client-wallets'],
    // The envelope rather than just `data`: `meta` carries the clients that
    // have no wallet yet, which are the only way to fund a new client.
    queryFn: () => api.envelope<ClientWalletList>('/admin/client-wallets'),
    refetchInterval: 120_000,
  })

  const pending = useQuery({
    queryKey: ['client-wallet-fundings'],
    queryFn: () => api.get<PendingClientWalletFunding[]>('/admin/client-wallet-fundings'),
    refetchInterval: 60_000,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['client-wallets'] })
    void queryClient.invalidateQueries({ queryKey: ['client-wallet-fundings'] })
  }

  if (query.isPending) return <Loading label="Loading client wallets" />
  if (query.isError) return <Notice>Could not load client wallets.</Notice>

  const wallets = query.data.data
  const fundable: FundableClient[] = [
    ...wallets.map((wallet) => ({
      clientId: wallet.clientId,
      clientCode: wallet.clientCode,
      clientName: wallet.clientName,
      wallet,
    })),
    ...query.data.meta.clientsWithoutWallet.map((client) => ({ ...client, wallet: null })),
  ]
  const awaiting = pending.data ?? []
  const overdrawn = wallets.filter((w) => w.isOverdrawn)
  const unreconciled = wallets.filter((w) => w.balanceReconciledAt === null)

  return (
    <Screen
      number="15"
      title="Client wallets"
      description="What each internal service has been allocated, and what it has spent · ADR-019"
      actions={
        mayFund && fundable.length > 0 ? <Button onClick={() => setFundingFor(null)}>Request funding</Button> : null
      }
    >
      <div className="stack">
        {outcome && (
          <Notice tone="neutral" title={outcome.title}>
            {outcome.body}
          </Notice>
        )}

        {pending.isError && <Notice>Could not load the fundings awaiting approval.</Notice>}

        {awaiting.length > 0 && (
          <Panel
            title="Awaiting a second pair of eyes"
            subtitle="A funding request moves no money. Approving it does, and the requester cannot be the approver"
            flush
          >
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Client</th>
                    <th style={{ textAlign: 'right' }}>Amount</th>
                    <th>Reference and reason</th>
                    <th>Requested by</th>
                    {mayApprove && <th />}
                  </tr>
                </thead>
                <tbody>
                  {awaiting.map((funding) => (
                    <tr key={funding.id}>
                      <td>
                        <strong>{funding.clientCode}</strong>
                        <div className="panel__subtitle">{funding.clientName}</div>
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {naira(funding.amountMinor)}
                      </td>
                      <td>
                        <span className="mono">{funding.reference}</span>
                        <div className="panel__subtitle">{funding.reason}</div>
                      </td>
                      <td className="panel__subtitle">
                        {funding.requestedByUserId === user?.id ? 'You' : (funding.requestedByName ?? '—')}
                        <div>{new Date(funding.requestedAt).toLocaleString()}</div>
                      </td>
                      {mayApprove && (
                        <td style={{ textAlign: 'right' }}>
                          <Button variant="secondary" onClick={() => setReviewing(funding)}>
                            Review
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Panel>
        )}

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
              {mayFund && fundable.length > 0 && ' Use Request funding to give a client its first allocation.'}
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
                        <td style={{ textAlign: 'right' }}>
                          <Button variant="secondary" onClick={() => setFundingFor(wallet.clientId)}>
                            Fund
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
          <Notice tone="neutral" title="You can request funding, not approve it">
            A funding request moves no money. Somebody else has to approve it, and the person who requested it cannot
            be that person — which is the whole of the control.
          </Notice>
        )}
      </div>

      {fundingFor !== undefined && (
        <FundingDialog
          clients={fundable}
          initialClientId={fundingFor}
          mayAdjust={mayAdjust}
          run={run}
          onClose={() => setFundingFor(undefined)}
          onRequested={(client, amountMinor) => {
            setFundingFor(undefined)
            setOutcome({
              title: 'Funding requested',
              body: `${naira(amountMinor)} for ${client.clientCode} is waiting for another approver. No money has moved yet.`,
            })
            refresh()
          }}
        />
      )}

      {reviewing !== null && (
        <ReviewDialog
          funding={reviewing}
          wallet={wallets.find((w) => w.clientId === reviewing.clientId) ?? null}
          own={reviewing.requestedByUserId === user?.id}
          run={run}
          onClose={() => setReviewing(null)}
          onDecided={(decision) => {
            setReviewing(null)
            setOutcome(
              decision === 'approve'
                ? {
                    title: 'Funding approved',
                    body: `${naira(reviewing.amountMinor)} has been posted to ${reviewing.clientCode}'s wallet.`,
                  }
                : {
                    title: 'Funding rejected',
                    body: `The ${naira(reviewing.amountMinor)} request for ${reviewing.clientCode} was rejected. Nothing moved.`,
                  },
            )
            refresh()
          }}
        />
      )}

      {confirmDialog}
    </Screen>
  )
}

function FundingDialog({
  clients,
  initialClientId,
  mayAdjust,
  run,
  onClose,
  onRequested,
}: {
  clients: FundableClient[]
  initialClientId: number | null
  mayAdjust: boolean
  run: Run
  onClose: () => void
  onRequested: (client: FundableClient, amountMinor: number) => void
}) {
  const [clientId, setClientId] = useState(initialClientId === null ? '' : String(initialClientId))
  const [direction, setDirection] = useState<'add' | 'remove'>('add')
  const [amount, setAmount] = useState('')
  const [reference, setReference] = useState('')
  const [reason, setReason] = useState('')
  const [attempted, setAttempted] = useState(false)
  const [busy, setBusy] = useState(false)
  const [serverError, setServerError] = useState<ApiError | string | null>(null)

  const client = clients.find((c) => String(c.clientId) === clientId) ?? null
  const minor = parseNaira(amount)
  const signed = minor === null ? null : direction === 'add' ? minor : -minor
  const available = client?.wallet?.availableMinor ?? 0

  const serverFields = serverError instanceof ApiError ? serverError.fieldErrors() : {}
  const errors: Record<string, string> = {}
  if (!client) errors.client = 'Choose the client to fund.'
  if (minor === null) errors.amount = 'Enter an amount in naira greater than zero, for example 250,000 or 1500.50.'
  if (reference.trim() === '') errors.reference = 'Give the finance reference this allocation is recorded under.'
  if (reason.trim() === '') errors.reason = 'Say why, for the audit trail and for the approver.'

  const shown = (field: string, serverField = field) =>
    (attempted ? errors[field] : undefined) ?? serverFields[serverField]

  const submit = async () => {
    setAttempted(true)
    if (Object.keys(errors).length > 0 || !client || signed === null) return

    setBusy(true)
    setServerError(null)

    try {
      // The success handling lives inside the action so that it also runs
      // when the action is replayed after a password confirmation.
      await run(async () => {
        await api.post(`/admin/client-wallets/${client.clientId}/fundings`, {
          amountMinor: signed,
          reference: reference.trim(),
          reason: reason.trim(),
        })
        onRequested(client, Math.abs(signed))
      })
    } catch (caught) {
      setServerError(caught instanceof ApiError ? caught : 'The funding could not be requested.')
    } finally {
      setBusy(false)
    }
  }

  const unfieldedError =
    serverError === null
      ? null
      : typeof serverError === 'string'
        ? serverError
        : Object.keys(serverFields).length === 0
          ? serverError.message
          : null

  return (
    <Dialog
      title="Request funding"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Request funding
          </Button>
        </>
      }
    >
      <Notice tone="neutral">
        This request moves no money. Another operator has to approve it before the balance changes.
      </Notice>

      {unfieldedError && <Notice>{unfieldedError}</Notice>}

      <Select label="Client" value={clientId} onChange={setClientId}>
        <option value="">Choose a client</option>
        {clients.some((c) => c.wallet) && (
          <optgroup label="Has a wallet">
            {clients
              .filter((c) => c.wallet)
              .map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientCode} · {c.clientName}
                </option>
              ))}
          </optgroup>
        )}
        {clients.some((c) => !c.wallet) && (
          <optgroup label="No wallet yet — funding creates one">
            {clients
              .filter((c) => !c.wallet)
              .map((c) => (
                <option key={c.clientId} value={c.clientId}>
                  {c.clientCode} · {c.clientName}
                </option>
              ))}
          </optgroup>
        )}
      </Select>
      {shown('client') && <FieldError>{shown('client')}</FieldError>}

      {client && (
        <Details>
          <Detail label="Available now">
            <span className="mono">{client.wallet ? naira(available) : 'No wallet yet'}</span>
          </Detail>
          {client.wallet && <Detail label="Mode">{client.wallet.enforcementMode}</Detail>}
          {signed !== null && (
            <Detail label="After approval">
              <span className="mono">{naira(available + signed)}</span>
            </Detail>
          )}
        </Details>
      )}

      {mayAdjust && (
        <Select label="Type" value={direction} onChange={(value) => setDirection(value as 'add' | 'remove')}>
          <option value="add">Allocation — adds to the balance</option>
          <option value="remove">Correction — takes money out</option>
        </Select>
      )}

      <Field
        label="Amount (₦)"
        inputMode="decimal"
        placeholder="250,000"
        autoComplete="off"
        value={amount}
        error={shown('amount', 'amountMinor')}
        onChange={(event) => setAmount(event.target.value)}
      />
      <Field
        label="Finance reference"
        hint="The ticket or approval this allocation is recorded under."
        placeholder="ALLOC-2026-Q4"
        autoComplete="off"
        value={reference}
        error={shown('reference')}
        onChange={(event) => setReference(event.target.value)}
      />
      <Field
        label="Reason"
        hint="Shown to the approver and kept in the audit trail."
        value={reason}
        error={shown('reason')}
        onChange={(event) => setReason(event.target.value)}
      />
    </Dialog>
  )
}

function ReviewDialog({
  funding,
  wallet,
  own,
  run,
  onClose,
  onDecided,
}: {
  funding: PendingClientWalletFunding
  wallet: ClientWalletRow | null
  own: boolean
  run: Run
  onClose: () => void
  onDecided: (decision: 'approve' | 'reject') => void
}) {
  const [note, setNote] = useState('')
  const [noteRequired, setNoteRequired] = useState(false)
  const [busy, setBusy] = useState<'approve' | 'reject' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const available = wallet?.availableMinor ?? 0

  const decide = async (decision: 'approve' | 'reject') => {
    if (decision === 'reject' && note.trim() === '') {
      setNoteRequired(true)
      return
    }

    setBusy(decision)
    setError(null)

    try {
      await run(async () => {
        await api.post(
          `/admin/client-wallet-fundings/${funding.id}/${decision}`,
          decision === 'reject' ? { reason: note.trim() } : note.trim() ? { note: note.trim() } : {},
        )
        onDecided(decision)
      })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The decision could not be recorded.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <Dialog
      title={`Funding for ${funding.clientCode}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={() => void decide('reject')} loading={busy === 'reject'} disabled={own}>
            Reject
          </Button>
          <Button onClick={() => void decide('approve')} loading={busy === 'approve'} disabled={own}>
            Approve {naira(funding.amountMinor)}
          </Button>
        </>
      }
    >
      {error && <Notice>{error}</Notice>}

      {own && (
        <Notice title="You requested this funding">
          Somebody else has to approve or reject it. The platform refuses a decision by the requester, whatever
          permissions they hold.
        </Notice>
      )}

      <Details>
        <Detail label="Client">
          {funding.clientCode} · {funding.clientName}
        </Detail>
        <Detail label="Amount">
          <span className="mono">{naira(funding.amountMinor)}</span>
          {funding.amountMinor < 0 && ' (correction)'}
        </Detail>
        <Detail label="Reference">
          <span className="mono">{funding.reference}</span>
        </Detail>
        <Detail label="Reason">{funding.reason}</Detail>
        <Detail label="Requested by">
          {own ? 'You' : (funding.requestedByName ?? '—')}, {new Date(funding.requestedAt).toLocaleString()}
        </Detail>
        <Detail label="Available now">
          <span className="mono">{wallet ? naira(available) : 'No wallet yet'}</span>
        </Detail>
        <Detail label="After approval">
          <span className="mono">{naira(available + funding.amountMinor)}</span>
        </Detail>
      </Details>

      {!own && (
        <Field
          label="Note"
          hint="Optional when approving. Required when rejecting — the requester sees why."
          value={note}
          error={noteRequired && note.trim() === '' ? 'Say why this funding is rejected.' : undefined}
          onChange={(event) => setNote(event.target.value)}
        />
      )}
    </Dialog>
  )
}

/** For a control with no `error` prop of its own, such as `Select`. */
function FieldError({ children }: { children: string }) {
  return (
    <div style={{ marginTop: 'var(--space-1)', fontSize: '12px', color: 'var(--color-accent-700)' }}>{children}</div>
  )
}
