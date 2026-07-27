import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { TransactionDetail } from '../lib/types'
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
  StatusTag,
  Tag,
} from '../components/ui'

export function TransactionDetailPage() {
  const { reference } = useParams<{ reference: string }>()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)
  const [resolving, setResolving] = useState<'SUCCESS' | 'FAILED' | null>(null)
  const [reviewing, setReviewing] = useState(false)

  const query = useQuery({
    queryKey: ['transaction', reference],
    queryFn: () => api.get<TransactionDetail>(`/admin/transactions/${reference}`),
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['transaction', reference] })

  const act = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await run(action)
      refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The action failed.')
    }
  }

  if (query.isPending) return <Loading label="Loading transaction" />
  if (query.isError) return <Notice>Could not load this transaction.</Notice>

  const txn = query.data
  const uncertain = txn.attempts.some((attempt) => attempt.mayHaveDeliveredValue && !txn.terminal)

  return (
    <Screen
      number="02"
      title={txn.transactionReference}
      description={`${txn.productCode} · ${txn.amount.currency} ${txn.amount.value} · ${txn.apiClient.name ?? 'Unknown client'}`}
      actions={
        <>
          {can(Permission.TransactionsRequery) && !txn.terminal && (
            <Button
              variant="secondary"
              onClick={() => void act(() => api.post(`/admin/transactions/${txn.transactionReference}/requery`))}
            >
              Requery provider
            </Button>
          )}
          {can(Permission.TransactionsResolve) && !txn.terminal && txn.status !== 'MANUAL_REVIEW' && (
            <Button variant="secondary" onClick={() => setReviewing(true)}>
              Move to manual review
            </Button>
          )}
          {can(Permission.TransactionsResolve) && txn.status === 'MANUAL_REVIEW' && (
            <>
              <Button variant="secondary" onClick={() => setResolving('FAILED')}>
                Resolve failed
              </Button>
              <Button onClick={() => setResolving('SUCCESS')}>Resolve successful</Button>
            </>
          )}
        </>
      }
    >
      <div className="stack">
        <Link to="/transactions" style={{ fontSize: '13px' }}>
          ← All transactions
        </Link>

        {error && <Notice>{error}</Notice>}

        {uncertain && (
          <Notice title="Outcome is uncertain">
            A provider attempt may have delivered value. Do not resolve this transaction as failed without provider
            evidence — the platform never treats a timeout as proof of failure (PRD §12.7).
          </Notice>
        )}

        <div className="grid-2">
          <Panel title="Canonical record">
            <Details>
              <Detail label="Status">
                <StatusTag status={txn.status} />
              </Detail>
              <Detail label="Client reference">
                <span className="mono">{txn.clientReference}</span>
              </Detail>
              <Detail label="API client">{txn.apiClient.name ?? '—'}</Detail>
              <Detail label="Service">
                {txn.categoryCode} · {txn.billerCode} · {txn.productCode}
              </Detail>
              <Detail label="Customer">
                <span className="mono">{txn.customerIdentifier}</span>{' '}
                {txn.customerIdentifierUnmasked && <Tag tone="outline">unmasked · audited</Tag>}
              </Detail>
              <Detail label="Amount">
                <span className="mono">
                  {txn.amount.currency} {txn.amount.value}
                </span>
              </Detail>
              <Detail label="Provider">{txn.selectedProviderCode ?? 'Not yet selected'}</Detail>
              <Detail label="Requested">{new Date(txn.requestedAt).toLocaleString()}</Detail>
              <Detail label="Completed">
                {txn.completedAt ? new Date(txn.completedAt).toLocaleString() : 'Not settled'}
              </Detail>
              {txn.failure && (
                <Detail label="Failure">
                  <div>{txn.failure.code}</div>
                  <div className="panel__subtitle">{txn.failure.message}</div>
                </Detail>
              )}
            </Details>
          </Panel>

          <div className="stack">
            <Panel title="Payment authorization" subtitle="Funds reservation held by the calling service">
              {txn.paymentAuthorization ? (
                <Details>
                  <Detail label="Reference">
                    <span className="mono">{txn.paymentAuthorization.reference}</span>
                  </Detail>
                  <Detail label="Source system">{txn.paymentAuthorization.sourceSystem}</Detail>
                  <Detail label="Reservation">
                    <StatusTag status={txn.paymentAuthorization.status} />
                  </Detail>
                  <Detail label="Verified via">{txn.paymentAuthorization.verifiedVia}</Detail>
                  <Detail label="Consumed">
                    {txn.paymentAuthorization.consumedAt
                      ? new Date(txn.paymentAuthorization.consumedAt).toLocaleString()
                      : txn.paymentAuthorization.releasedAt
                        ? `Released ${new Date(txn.paymentAuthorization.releasedAt).toLocaleString()}`
                        : 'Held'}
                  </Detail>
                </Details>
              ) : (
                <EmptyState title="No authorization recorded">
                  The transaction failed before the authorization boundary.
                </EmptyState>
              )}
            </Panel>

            <Panel title="Fulfilment" subtitle="Encrypted at rest; tokens require a dedicated permission">
              {txn.fulfilment ? (
                <Details>
                  {Object.entries(txn.fulfilment).map(([key, value]) => (
                    <Detail key={key} label={key}>
                      <span className="mono">{value}</span>
                    </Detail>
                  ))}
                </Details>
              ) : (
                <EmptyState title="No value delivered yet" />
              )}
            </Panel>
          </div>
        </div>

        <Panel title="Status history" subtitle="Append-only · PRD §12.11" flush>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>From</th>
                  <th>To</th>
                  <th>Actor</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {txn.statusHistory.map((entry, index) => (
                  <tr key={index}>
                    <td className="panel__subtitle">{new Date(entry.at).toLocaleString()}</td>
                    <td>{entry.from ?? '—'}</td>
                    <td>
                      <StatusTag status={entry.to} />
                    </td>
                    <td>
                      {entry.actorType}
                      {entry.actorId ? ` · ${entry.actorId}` : ''}
                    </td>
                    <td className="panel__subtitle">{entry.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>

        <Panel
          title="Routing decision"
          subtitle="Why this provider — recorded before any provider was contacted · PRD §12.7"
          flush
        >
          {txn.routingDecision === null ? (
            <EmptyState title="No routing decision recorded">
              The transaction failed before provider selection.
            </EmptyState>
          ) : (
            <>
              <div className="panel__body" style={{ paddingBottom: 0 }}>
                <Details>
                  <Detail label="Selected">
                    {txn.routingDecision.selectedProviderCode ? (
                      <>
                        {txn.routingDecision.selectedProviderCode}
                        {txn.routingDecision.selectedMappingVersion && (
                          <span className="panel__subtitle"> · mapping v{txn.routingDecision.selectedMappingVersion}</span>
                        )}
                      </>
                    ) : (
                      <Tag>none eligible</Tag>
                    )}
                  </Detail>
                  <Detail label="Considered">
                    {txn.routingDecision.eligibleCount} eligible, {txn.routingDecision.excludedCount} excluded
                  </Detail>
                  <Detail label="Policy">
                    <span className="mono">{txn.routingDecision.policy}</span>
                  </Detail>
                </Details>
              </div>
              <div className="table-wrap" style={{ marginTop: 'var(--space-4)' }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Provider</th>
                      <th>Outcome</th>
                      <th>Priority</th>
                      <th>Reason</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txn.routingDecision.candidates.map((candidate) => (
                      <tr key={candidate.providerCode}>
                        <td>
                          <div>{candidate.providerCode}</div>
                          {candidate.providerProductCode && (
                            <div className="panel__subtitle mono">{candidate.providerProductCode}</div>
                          )}
                        </td>
                        <td>
                          {candidate.providerCode === txn.routingDecision?.selectedProviderCode ? (
                            <Tag tone="accent">selected</Tag>
                          ) : candidate.eligible ? (
                            <Tag tone="outline">eligible</Tag>
                          ) : (
                            <Tag>excluded</Tag>
                          )}
                        </td>
                        <td className="mono">{candidate.priority ?? '—'}</td>
                        <td className="panel__subtitle">{candidate.reason ?? '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>

        <Panel title="Provider attempts" subtitle="Append-only · PRD §12.12" flush>
          {txn.attempts.length === 0 ? (
            <EmptyState title="No provider attempt was made" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Provider</th>
                    <th>Vend reference</th>
                    <th>Provider transaction</th>
                    <th>Mapped product</th>
                    <th>Status</th>
                    <th>Requeries</th>
                  </tr>
                </thead>
                <tbody>
                  {txn.attempts.map((attempt) => (
                    <tr key={attempt.id}>
                      <td>{attempt.attemptNumber}</td>
                      <td>
                        <div>{attempt.providerCode}</div>
                        <div className="panel__subtitle">{attempt.environment}</div>
                      </td>
                      <td className="mono">{attempt.providerVendReference}</td>
                      <td className="mono">{attempt.providerTransactionReference ?? '—'}</td>
                      <td>
                        <div className="mono">{attempt.providerProductCode ?? '—'}</div>
                        {attempt.mappingVersion && (
                          <div className="panel__subtitle">mapping v{attempt.mappingVersion}</div>
                        )}
                      </td>
                      <td>
                        <StatusTag status={attempt.status} />
                        {attempt.mayHaveDeliveredValue && !['SUCCESS'].includes(attempt.status) && (
                          <div className="panel__subtitle">may have delivered value</div>
                        )}
                      </td>
                      <td>{attempt.requeryCount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <div className="grid-2">
          <Panel title="Provider webhooks" subtitle="Inbox · PRD §12.14" flush>
            {txn.webhookEvents.length === 0 ? (
              <EmptyState title="No webhook received" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Received</th>
                      <th>Event</th>
                      <th>Signature</th>
                      <th>Processing</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txn.webhookEvents.map((event) => (
                      <tr key={event.id}>
                        <td className="panel__subtitle">{new Date(event.receivedAt).toLocaleString()}</td>
                        <td>
                          <div>{event.eventType ?? '—'}</div>
                          <div className="panel__subtitle mono">{event.providerEventId ?? '—'}</div>
                        </td>
                        <td>{event.signatureVerified ? <Tag tone="accent">verified</Tag> : <Tag>unverified</Tag>}</td>
                        <td>
                          <StatusTag status={event.processingStatus} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>

          <Panel title="Client callbacks" subtitle="Outbox · PRD §14.6" flush>
            {txn.callbacks.length === 0 ? (
              <EmptyState title="No callback queued">
                The client has no callback URL, or the transaction has not reached a notifiable state.
              </EmptyState>
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Event</th>
                      <th>Status</th>
                      <th>Attempts</th>
                      <th>Last response</th>
                    </tr>
                  </thead>
                  <tbody>
                    {txn.callbacks.map((callback) => (
                      <tr key={callback.id}>
                        <td>
                          <div>{callback.eventType}</div>
                          <div className="panel__subtitle mono">{callback.eventId}</div>
                        </td>
                        <td>
                          <StatusTag status={callback.status} />
                        </td>
                        <td>{callback.attempts}</td>
                        <td className="panel__subtitle">
                          {callback.lastResponseStatus ?? callback.lastError ?? 'Delivered'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Panel>
        </div>
      </div>

      {reviewing && (
        <ReasonDialog
          title="Move to manual review"
          confirmLabel="Move to review"
          onClose={() => setReviewing(false)}
          onConfirm={async (reason) => {
            setReviewing(false)
            await act(() =>
              api.post(`/admin/transactions/${txn.transactionReference}/manual-review`, { reason }),
            )
          }}
        />
      )}

      {resolving && (
        <ReasonDialog
          title={`Resolve as ${resolving.toLowerCase()}`}
          confirmLabel="Resolve"
          warning={
            resolving === 'FAILED'
              ? 'Only resolve as failed when provider evidence confirms no value was delivered. This releases the funds reservation.'
              : 'Only resolve as successful when provider evidence confirms the value was delivered. This consumes the funds reservation.'
          }
          onClose={() => setResolving(null)}
          onConfirm={async (reason) => {
            const status = resolving
            setResolving(null)
            await act(() =>
              api.post(`/admin/transactions/${txn.transactionReference}/resolve`, { status, reason }),
            )
          }}
        />
      )}

      {confirmDialog}
    </Screen>
  )
}

function ReasonDialog({
  title,
  confirmLabel,
  warning,
  onClose,
  onConfirm,
}: {
  title: string
  confirmLabel: string
  warning?: string
  onClose: () => void
  onConfirm: (reason: string) => Promise<void>
}) {
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Dialog
      title={title}
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={reason.trim().length === 0}
            onClick={() => {
              setBusy(true)
              void onConfirm(reason).finally(() => setBusy(false))
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      {warning && <Notice>{warning}</Notice>}
      <Field
        label="Reason"
        hint="Recorded in the status history and the audit trail."
        value={reason}
        onChange={(event) => setReason(event.target.value)}
      />
    </Dialog>
  )
}
