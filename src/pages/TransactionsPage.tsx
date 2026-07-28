import { useState } from 'react'
import { Link } from 'react-router'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '../lib/api'
import type { Paginated, TransactionAging, TransactionSummary } from '../lib/types'
import { Screen } from '../components/layout/Screen'
import { Button, EmptyState, Loading, Notice, Panel, Select, Stat, StatusTag } from '../components/ui'

const STATUSES = [
  'RECEIVED',
  'AUTHORIZING',
  'AUTHORIZED',
  'QUEUED',
  'VENDING',
  'PENDING_PROVIDER',
  'UNKNOWN',
  'MANUAL_REVIEW',
  'SUCCESS',
  'FAILED',
  'REVERSED',
  'CANCELLED',
]

/** What an operator reads, rather than the raw bucket edge in minutes. */
const AGE_LABELS: Record<string, string> = {
  '60': 'under 1h',
  '360': '1–6h',
  '1440': '6–24h',
  older: 'over 24h',
}

/**
 * How long the queue has been waiting, above the queue itself.
 *
 * The last bucket is separated out rather than shown as one more column: past
 * 24 hours automated requery has given up, so those are the only ones that
 * cannot resolve without somebody.
 */
function AgingBar({ aging }: { aging: TransactionAging }) {
  const buckets = [...aging.bucketMinutes.map(String), 'older']

  return (
    <Panel title="Waiting" subtitle="Funds stay reserved until each of these settles · PRD §12.15">
      <div className="grid-4">
        {buckets.map((bucket) => {
          const count = aging.counts[bucket] ?? 0
          const overdue = bucket === 'older' && count > 0

          return (
            <Stat
              key={bucket}
              value={overdue ? <span style={{ color: 'var(--accent)' }}>{count}</span> : count}
              label={AGE_LABELS[bucket] ?? bucket}
            />
          )
        })}
      </div>

      {aging.beyondBoundary > 0 && (
        <p className="panel__subtitle" style={{ marginTop: 'var(--space-3)' }}>
          {aging.beyondBoundary} past the 24-hour requery window. Nothing further will happen to these automatically —
          resolve them against provider evidence, never against the fact that they are old.
        </p>
      )}
    </Panel>
  )
}

export function TransactionsPage({ manualReview = false }: { manualReview?: boolean }) {
  const [search, setSearch] = useState('')
  const [submitted, setSubmitted] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)

  // Only on the review queue: on the full transaction list most rows are
  // settled, and ageing them would say nothing.
  const aging = useQuery({
    queryKey: ['transactions', 'aging', { manualReview }],
    queryFn: () => api.get<TransactionAging>(`/admin/transactions/aging?manualReview=${manualReview ? 1 : 0}`),
    enabled: manualReview,
  })

  const query = useQuery({
    queryKey: ['transactions', { submitted, status, page, manualReview }],
    queryFn: () => {
      const params = new URLSearchParams({ page: String(page), perPage: '25' })
      if (submitted) params.set('search', submitted)
      if (status) params.set('status', status)
      if (manualReview) params.set('manualReview', '1')

      return api.get<Paginated<TransactionSummary>['data']>(`/admin/transactions?${params}`)
    },
    placeholderData: keepPreviousData,
  })

  return (
    <Screen
      number={manualReview ? '03' : '02'}
      title={manualReview ? 'Manual review' : 'Transactions'}
      description={
        manualReview
          ? 'Transactions the platform could not settle automatically. Expiry of the 24-hour requery window is not evidence that vending failed — resolve only against provider evidence.'
          : 'Every vend the platform has accepted. Search by platform, client, authorization or provider reference, or by the customer identifier itself.'
      }
    >
      <div className="stack">
        {manualReview && aging.data && aging.data.total > 0 && <AgingBar aging={aging.data} />}

        {!manualReview && (
          <Panel>
            <form
              className="row"
              style={{ alignItems: 'flex-end', gap: 'var(--space-3)' }}
              onSubmit={(event) => {
                event.preventDefault()
                setPage(1)
                setSubmitted(search.trim())
              }}
            >
              <div className="field" style={{ flex: '1 1 320px' }}>
                <label htmlFor="txn-search">Reference or customer identifier</label>
                <input
                  id="txn-search"
                  className="input"
                  value={search}
                  placeholder="bvt_…, BILL-…, PAY-AUTH-…, BAP-…, 2348012345678"
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>
              <div style={{ flex: '0 1 220px' }}>
                <Select
                  label="Status"
                  value={status}
                  onChange={(value) => {
                    setPage(1)
                    setStatus(value)
                  }}
                >
                  <option value="">Any status</option>
                  {STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">Search</Button>
              {(submitted || status) && (
                <Button
                  variant="ghost"
                  onClick={() => {
                    setSearch('')
                    setSubmitted('')
                    setStatus('')
                    setPage(1)
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
          </Panel>
        )}

        <Panel flush>
          {query.isPending ? (
            <Loading label="Loading transactions" />
          ) : query.isError ? (
            <div className="panel__body">
              <Notice>Could not load transactions.</Notice>
            </div>
          ) : query.data.length === 0 ? (
            <EmptyState title={manualReview ? 'Nothing awaiting review' : 'No transactions found'}>
              {manualReview
                ? 'Every pending and unknown transaction has settled within its requery window.'
                : 'Adjust the search or status filter.'}
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Transaction ref</th>
                    <th>Client / client ref</th>
                    <th>Service</th>
                    <th>Customer</th>
                    <th>Amount</th>
                    <th>Provider</th>
                    <th>Status</th>
                    <th>Requested</th>
                  </tr>
                </thead>
                <tbody>
                  {query.data.map((transaction) => (
                    <tr key={transaction.transactionReference}>
                      <td>
                        <Link to={`/transactions/${transaction.transactionReference}`} className="mono">
                          {transaction.transactionReference}
                        </Link>
                      </td>
                      <td>
                        <div>{transaction.apiClient.name ?? '—'}</div>
                        <div className="panel__subtitle mono">{transaction.clientReference}</div>
                      </td>
                      <td>
                        <div>{transaction.productCode}</div>
                        <div className="panel__subtitle">{transaction.categoryCode}</div>
                      </td>
                      <td className="mono">{transaction.customerIdentifierMasked}</td>
                      <td className="mono">
                        {transaction.amount.currency} {transaction.amount.value}
                      </td>
                      <td>{transaction.selectedProviderCode ?? '—'}</td>
                      <td>
                        <StatusTag status={transaction.status} />
                      </td>
                      <td className="panel__subtitle">{new Date(transaction.requestedAt).toLocaleString()}</td>
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
                disabled={query.data.length < 25}
                onClick={() => setPage((value) => value + 1)}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </div>
    </Screen>
  )
}
