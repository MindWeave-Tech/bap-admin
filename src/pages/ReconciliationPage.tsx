import { useRef, useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ReconciliationBatchRow, VarianceQueue, VarianceRow } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { Screen } from '../components/layout/Screen'
import { Button, EmptyState, Loading, Notice, Panel, Select, Stat, Tag } from '../components/ui'

function naira(minor: number | null): string {
  if (minor === null) return '—'

  return `₦${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

function day(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' })
}

/**
 * How much a finding matters, in a word.
 *
 * The two missing sides are not symmetric and the screen must not let them look
 * it: a transaction the provider has and we do not means value moved that was
 * never recorded, while the reverse is usually a failure both sides agree about.
 */
const VARIANCE_LABELS: Record<string, string> = {
  MISSING_INTERNALLY: 'value we never recorded',
  DUPLICATE: 'two sides do not pair up',
  STATUS_MISMATCH: 'outcomes disagree',
  AMOUNT_MISMATCH: 'amounts disagree',
  MISSING_AT_PROVIDER: 'provider has no record',
  MANUAL_REVIEW: 'needs a decision',
}

const FILTERS = [
  { value: '', label: 'All variances' },
  { value: 'MISSING_INTERNALLY', label: 'Value we never recorded' },
  { value: 'DUPLICATE', label: 'Two sides do not pair up' },
  { value: 'STATUS_MISMATCH', label: 'Outcomes disagree' },
  { value: 'AMOUNT_MISMATCH', label: 'Amounts disagree' },
  { value: 'MISSING_AT_PROVIDER', label: 'Provider has no record' },
]

export function ReconciliationPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()

  const mayResolve = can(Permission.ReconciliationResolve)

  const [status, setStatus] = useState('')
  const [showResolved, setShowResolved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [openVariance, setOpenVariance] = useState<number | null>(null)

  const batches = useQuery({
    queryKey: ['reconciliation-batches'],
    queryFn: () => api.get<ReconciliationBatchRow[]>('/admin/reconciliation/batches'),
  })

  const variances = useQuery({
    queryKey: ['reconciliation-variances', { status, showResolved }],
    queryFn: () => {
      const params = new URLSearchParams()
      if (status) params.set('status', status)
      if (showResolved) params.set('includeResolved', '1')

      return api.envelope<VarianceQueue>(`/admin/reconciliation/variances?${params}`)
    },
    placeholderData: keepPreviousData,
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['reconciliation-variances'] })
    void queryClient.invalidateQueries({ queryKey: ['reconciliation-batches'] })
  }

  const act = async (work: () => Promise<unknown>, fallback: string) => {
    setError(null)
    setNotice(null)

    try {
      await work()
      refresh()

      return true
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : fallback)

      return false
    }
  }

  if (batches.isPending) return <Loading label="Loading reconciliation" />
  if (batches.isError) return <Notice>Could not load reconciliation batches.</Notice>

  const rows = variances.data?.data ?? []
  const outstanding = variances.data?.meta.total ?? 0
  const dangerous = rows.filter((row) => row.status === 'MISSING_INTERNALLY' && row.resolvedAt === null).length
  const uncompared = batches.data.filter((batch) => batch.matchedAt === null).length

  return (
    <Screen
      number="10"
      title="Reconciliation"
      description="What the platform believes happened, checked against the provider's own books · PRD §12.18"
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}
        {notice && <Notice title="Done">{notice}</Notice>}

        {dangerous > 0 && (
          <Notice title={`${dangerous} record${dangerous === 1 ? '' : 's'} the platform never wrote`}>
            The provider moved value against {dangerous === 1 ? 'a transaction' : 'transactions'} with no counterpart
            here. That is the finding this screen exists for — treat it before anything else in the queue.
          </Notice>
        )}

        <div className="grid-3">
          <Stat value={outstanding} label={showResolved ? 'Findings listed' : 'Outstanding variances'} />
          <Stat value={batches.data.length} label="Batches" />
          <Stat value={uncompared} label="Never compared" />
        </div>

        <Panel
          title="Variance queue"
          subtitle="Ordered by what a finding would cost, not by when it was found"
          flush
          actions={
            <div className="row">
              <Select label="Type" value={status} onChange={(value) => setStatus(value)}>
                {FILTERS.map((filter) => (
                  <option key={filter.value} value={filter.value}>
                    {filter.label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" onClick={() => setShowResolved(!showResolved)}>
                {showResolved ? 'Show outstanding' : 'Include resolved'}
              </Button>
            </div>
          }
        >
          {variances.isPending ? (
            <Loading label="Loading variances" />
          ) : rows.length === 0 ? (
            <EmptyState title={showResolved ? 'Nothing found yet' : 'No outstanding variances'}>
              {uncompared > 0
                ? 'Some batches have not been compared yet, so this is not the same as the books balancing.'
                : 'Every compared transaction agrees with the provider.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Finding</th>
                    <th>Reference</th>
                    <th style={{ textAlign: 'right' }}>Platform</th>
                    <th style={{ textAlign: 'right' }}>Provider</th>
                    <th>What it says</th>
                    {mayResolve && <th />}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <VarianceLine
                      key={row.id}
                      row={row}
                      mayResolve={mayResolve}
                      open={openVariance === row.id}
                      onToggle={() => setOpenVariance(openVariance === row.id ? null : row.id)}
                      onResolve={async (reason, correctTo) => {
                        const ok = await act(
                          () =>
                            api.post(`/admin/reconciliation/variances/${row.id}/resolve`, {
                              reason,
                              ...(correctTo ? { correctTo } : {}),
                            }),
                          'The variance could not be resolved.',
                        )

                        if (ok) setOpenVariance(null)

                        return ok
                      }}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel
          title="Batches"
          subtitle="One comparison per provider per window. Import the provider's side, then compare"
          flush
        >
          {batches.data.length === 0 ? (
            <EmptyState title="No batches yet">
              A batch opens automatically for any provider that lists its own transactions. For the rest, open one and
              upload their statement.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Window</th>
                    <th>Compared</th>
                    <th style={{ textAlign: 'right' }}>Matched</th>
                    <th style={{ textAlign: 'right' }}>Variances</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {batches.data.map((batch) => (
                    <BatchLine
                      key={batch.id}
                      batch={batch}
                      mayResolve={mayResolve}
                      onImported={(message) => {
                        setNotice(message)
                        setError(null)
                        refresh()
                      }}
                      onError={setError}
                      onMatch={() =>
                        act(
                          () => api.post(`/admin/reconciliation/batches/${batch.id}/match`, {}),
                          'The comparison could not be run.',
                        )
                      }
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>
    </Screen>
  )
}

function VarianceLine({
  row,
  mayResolve,
  open,
  onToggle,
  onResolve,
}: {
  row: VarianceRow
  mayResolve: boolean
  open: boolean
  onToggle: () => void
  onResolve: (reason: string, correctTo: string) => Promise<boolean>
}) {
  const [reason, setReason] = useState('')
  const [correctTo, setCorrectTo] = useState('')
  const [saving, setSaving] = useState(false)

  const corrections = row.internal?.correctableTo ?? []
  const resolved = row.resolvedAt !== null

  return (
    <>
      <tr>
        <td>
          <Tag tone={row.consequence >= 80 ? 'accent' : 'neutral'}>
            {VARIANCE_LABELS[row.status] ?? row.status.toLowerCase()}
          </Tag>
          {resolved && (
            <div>
              <Tag tone="outline">resolved</Tag>
            </div>
          )}
        </td>
        <td className="mono">
          {row.internal?.transactionReference ? (
            <Link to={`/transactions/${row.internal.transactionReference}`}>{row.internal.reference}</Link>
          ) : (
            // No transaction to link to — that absence is the finding.
            <span className="panel__subtitle">{row.external?.reference ?? '—'}</span>
          )}
        </td>
        <td className="mono" style={{ textAlign: 'right' }}>
          {naira(row.internal?.amountMinor ?? null)}
          <div className="panel__subtitle">{row.internal?.status?.toLowerCase() ?? 'no record'}</div>
        </td>
        <td className="mono" style={{ textAlign: 'right' }}>
          {naira(row.external?.amountMinor ?? null)}
          <div className="panel__subtitle">
            {/* What the statement literally said, not what we read it as. */}
            {row.external?.providerStatusRaw ?? 'no record'}
          </div>
        </td>
        <td className="panel__subtitle">{row.detail ?? '—'}</td>
        {mayResolve && (
          <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
            {!resolved && (
              <Button variant="secondary" onClick={onToggle}>
                {open ? 'Cancel' : 'Resolve'}
              </Button>
            )}
          </td>
        )}
      </tr>

      {resolved && (
        <tr>
          <td colSpan={mayResolve ? 6 : 5} className="panel__subtitle">
            Closed by {row.resolvedBy ?? 'unknown'}: {row.resolutionReason}
          </td>
        </tr>
      )}

      {open && mayResolve && (
        <tr>
          <td colSpan={6}>
            <div className="stack">
              <label className="field">
                <span className="field__label">Why is this being closed?</span>
                <textarea
                  className="input"
                  rows={2}
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="What was checked, and with whom"
                />
              </label>

              {corrections.length > 0 ? (
                <>
                  <Select label="Correct the transaction (optional)" value={correctTo} onChange={setCorrectTo}>
                    <option value="">Leave the transaction as it is</option>
                    {corrections.map((value) => (
                      <option key={value} value={value}>
                        Set to {value.toLowerCase()}
                      </option>
                    ))}
                  </Select>
                  <p className="panel__subtitle">
                    Closing a finding is not the same as correcting one. A correction changes what the platform tells
                    the client, is recorded against your name, and cannot be undone here.
                  </p>
                </>
              ) : (
                <p className="panel__subtitle">
                  {row.internal
                    ? 'This transaction is in a final state, so its status cannot be corrected. If the provider disagrees, take it up with them.'
                    : 'There is no transaction here to correct — the provider has a record the platform does not.'}
                </p>
              )}

              <div className="row">
                <Button
                  loading={saving}
                  disabled={reason.trim() === ''}
                  onClick={() => {
                    setSaving(true)
                    void onResolve(reason.trim(), correctTo).finally(() => setSaving(false))
                  }}
                >
                  {correctTo ? `Close and set ${correctTo.toLowerCase()}` : 'Close finding'}
                </Button>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  )
}

function BatchLine({
  batch,
  mayResolve,
  onImported,
  onError,
  onMatch,
}: {
  batch: ReconciliationBatchRow
  mayResolve: boolean
  onImported: (message: string) => void
  onError: (message: string) => void
  onMatch: () => Promise<boolean>
}) {
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  const importStatement = async (file: File) => {
    setBusy(true)

    try {
      const form = new FormData()
      form.append('statement', file)

      const result = await api.upload<{ acceptedCount: number; rejectedCount: number }>(
        `/admin/reconciliation/batches/${batch.id}/imports`,
        form,
      )

      // What parsed and what did not, before anything is concluded from it.
      // Nothing is compared until the comparison is run.
      onImported(
        result.rejectedCount > 0
          ? `${result.acceptedCount} rows read, ${result.rejectedCount} could not be and were not counted. Check them before comparing.`
          : `${result.acceptedCount} rows read. Run the comparison when ready.`,
      )
    } catch (caught) {
      onError(caught instanceof ApiError ? caught.message : 'The statement could not be imported.')
    } finally {
      setBusy(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  return (
    <tr>
      <td>
        <div>{batch.providerCode}</div>
        <div className="panel__subtitle">{batch.environment}</div>
      </td>
      <td className="panel__subtitle">
        {day(batch.windowStartsAt)} → {day(batch.windowEndsAt)}
      </td>
      <td>
        {batch.matchedAt === null ? (
          // Never compared and compared-and-clean are different claims.
          <Tag>never compared</Tag>
        ) : (
          <span className="panel__subtitle">{new Date(batch.matchedAt).toLocaleString()}</span>
        )}
      </td>
      <td className="mono" style={{ textAlign: 'right' }}>
        {batch.matchedAt === null ? '—' : batch.matchedCount}
      </td>
      <td className="mono" style={{ textAlign: 'right' }}>
        {batch.matchedAt === null ? '—' : batch.varianceCount}
      </td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        {mayResolve && (
          <>
            <input
              ref={fileInput}
              type="file"
              accept=".csv,.txt,.xlsx"
              style={{ display: 'none' }}
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) void importStatement(file)
              }}
            />
            <Button variant="secondary" loading={busy} onClick={() => fileInput.current?.click()}>
              Upload statement
            </Button>{' '}
            <Button variant="secondary" onClick={() => void onMatch()}>
              Compare
            </Button>{' '}
          </>
        )}
        <Button
          variant="secondary"
          disabled={batch.matchedAt === null}
          onClick={() =>
            void api.download(
              `/admin/reconciliation/batches/${batch.id}/export`,
              `reconciliation-batch${batch.id}.csv`,
            )
          }
        >
          Export
        </Button>
      </td>
    </tr>
  )
}
