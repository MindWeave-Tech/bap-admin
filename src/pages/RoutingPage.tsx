import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type {
  BreakerExclusion,
  RoutingChangeRequestSummary,
  RoutingPolicySummary,
  RoutingSimulation,
} from '../lib/types'
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
  Tag,
} from '../components/ui'

/** Versions share a scope; only the newest effective one actually orders traffic. */
function scopeLabel(scope: string, value: string | null): string {
  return value === null ? scope : `${scope} · ${value}`
}

function inForceIds(policies: RoutingPolicySummary[]): Set<number> {
  const winner = new Map<string, RoutingPolicySummary>()

  for (const policy of policies) {
    if (!policy.inForce) continue

    const key = scopeLabel(policy.scope, policy.scopeValue)
    const held = winner.get(key)

    if (held === undefined || policy.version > held.version) winner.set(key, policy)
  }

  return new Set([...winner.values()].map((policy) => policy.id))
}

export function RoutingPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<RoutingChangeRequestSummary | null>(null)
  const [note, setNote] = useState('')

  const policies = useQuery({
    queryKey: ['routing', 'policies'],
    queryFn: () => api.get<RoutingPolicySummary[]>('/admin/routing/policies'),
  })

  const requests = useQuery({
    queryKey: ['routing', 'change-requests'],
    queryFn: () => api.get<RoutingChangeRequestSummary[]>('/admin/routing/change-requests'),
  })

  const breakerEvents = useQuery({
    queryKey: ['routing', 'breaker-events'],
    queryFn: () => api.get<BreakerExclusion[]>('/admin/routing/breaker-events'),
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['routing'] })

  const review = async (decision: 'approve' | 'reject') => {
    if (reviewing === null) return

    setError(null)

    try {
      await run(() =>
        api.post(`/admin/routing/change-requests/${reviewing.id}/review`, { decision, note: note || undefined }),
      )
      setReviewing(null)
      setNote('')
      refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The review could not be recorded.')
    }
  }

  const apply = async (request: RoutingChangeRequestSummary) => {
    setError(null)

    try {
      await run(() => api.post(`/admin/routing/change-requests/${request.id}/apply`, {}))
      refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The change could not be applied.')
    }
  }

  if (policies.isPending || requests.isPending) return <Loading label="Loading routing" />

  const mayApprove = can(Permission.RoutingApprove)
  const live = inForceIds(policies.data ?? [])
  const open = (requests.data ?? []).filter((request) => request.awaitingReview)

  return (
    <Screen
      number="05"
      title="Routing"
      description="Which provider serves a vend, and the approval trail behind every change · PRD §12.7"
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}

        {open.length > 0 && !mayApprove && (
          <Notice title={`${open.length} change ${open.length === 1 ? 'request is' : 'requests are'} awaiting review`}>
            Approving a routing change needs the <span className="mono">routing.approve</span> permission, which your
            role does not hold.
          </Notice>
        )}

        <Simulator />

        <Panel
          title="Policies"
          subtitle="The newest effective version for a scope orders traffic; earlier ones stay for audit"
          flush
        >
          {(policies.data ?? []).length === 0 ? (
            <EmptyState title="No routing policy has been set">
              Provider order falls back to mapping priority until a policy is approved and applied.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Provider order</th>
                    <th>Version</th>
                    <th>Effective</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(policies.data ?? []).map((policy) => (
                    <tr key={policy.id}>
                      <td>
                        <div>{scopeLabel(policy.scope, policy.scopeValue)}</div>
                        <div className="panel__subtitle">{policy.environment}</div>
                      </td>
                      <td className="mono">{policy.providerOrder.join(' → ')}</td>
                      <td>
                        v{policy.version}{' '}
                        {live.has(policy.id) ? (
                          <Tag tone="accent">in force</Tag>
                        ) : policy.inForce ? (
                          <Tag>superseded</Tag>
                        ) : (
                          <Tag tone="outline">scheduled</Tag>
                        )}
                      </td>
                      <td className="panel__subtitle">{new Date(policy.effectiveFrom).toLocaleString()}</td>
                      <td className="panel__subtitle">{policy.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <Panel title="Change requests" subtitle="A routing change needs a second pair of eyes · PRD §12.7" flush>
          {(requests.data ?? []).length === 0 ? (
            <EmptyState title="No change has been proposed" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Proposed order</th>
                    <th>Status</th>
                    <th>Requested by</th>
                    <th>Reviewed by</th>
                    {mayApprove && <th />}
                  </tr>
                </thead>
                <tbody>
                  {(requests.data ?? []).map((request) => (
                    <tr key={request.id}>
                      <td>
                        <div>{scopeLabel(request.scope, request.scopeValue)}</div>
                        <div className="panel__subtitle">{request.reason}</div>
                      </td>
                      <td className="mono">{request.proposedOrder.join(' → ')}</td>
                      <td>
                        <Tag tone={request.awaitingReview ? 'accent' : 'neutral'}>
                          {request.status.replaceAll('_', ' ').toLowerCase()}
                        </Tag>
                        {request.breakGlass && <Tag tone="outline">break glass</Tag>}
                      </td>
                      <td className="panel__subtitle">{request.requestedBy ?? '—'}</td>
                      <td className="panel__subtitle">{request.reviewedBy ?? 'Not yet reviewed'}</td>
                      {mayApprove && (
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {request.status === 'PENDING' && (
                            <Button variant="secondary" onClick={() => setReviewing(request)}>
                              Review
                            </Button>
                          )}
                          {request.status === 'APPROVED' && (
                            <Button onClick={() => void apply(request)}>Apply</Button>
                          )}
                          {request.status === 'APPLIED_PENDING_REVIEW' && (
                            <Button variant="secondary" onClick={() => setReviewing(request)}>
                              Confirm
                            </Button>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
        <Panel
          title="Circuit breaker history"
          subtitle="Providers withheld from new transactions on measured health · PRD §12.16"
          flush
        >
          {(breakerEvents.data ?? []).length === 0 ? (
            <EmptyState title="No provider has tripped a breaker">
              Every provider has stayed inside its failure and timeout thresholds.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Change</th>
                    <th>Evidence</th>
                    <th>When</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {(breakerEvents.data ?? []).map((event) => (
                    <tr key={event.id}>
                      <td>{event.providerCode}</td>
                      <td className="mono">
                        {event.from} → {event.to}
                      </td>
                      <td className="panel__subtitle">
                        {event.sampleSize === 0
                          ? '—'
                          : `${event.failureRatePercent}% failed, ${event.timeoutRatePercent}% timed out of ${event.sampleSize}`}
                      </td>
                      <td className="panel__subtitle">{new Date(event.occurredAt).toLocaleString()}</td>
                      <td className="panel__subtitle">{event.reason}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {reviewing !== null && (
        <Dialog
          title={`Change request #${reviewing.id}`}
          onClose={() => {
            setReviewing(null)
            setNote('')
          }}
          footer={
            <>
              <Button variant="secondary" onClick={() => void review('reject')}>
                Reject
              </Button>
              <Button onClick={() => void review('approve')}>Approve</Button>
            </>
          }
        >
          <Details>
            <Detail label="Scope">{scopeLabel(reviewing.scope, reviewing.scopeValue)}</Detail>
            <Detail label="Proposed order">
              <span className="mono">{reviewing.proposedOrder.join(' → ')}</span>
            </Detail>
            <Detail label="Reason">{reviewing.reason}</Detail>
            <Detail label="Expected impact">{reviewing.expectedImpact}</Detail>
            <Detail label="Rollback plan">{reviewing.rollbackPlan}</Detail>
            <Detail label="Requested by">{reviewing.requestedBy ?? '—'}</Detail>
          </Details>

          <Notice title="You cannot review your own request">
            The platform refuses a review by the person who proposed it, whatever permissions they hold.
          </Notice>

          <Field
            label="Note"
            hint="Required when rejecting."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Dialog>
      )}

      {confirmDialog}
    </Screen>
  )
}

/**
 * Answers what a vend would decide, optionally under an order that has not
 * been applied — so a change can be judged by its effect rather than by
 * reading provider codes.
 */
function Simulator() {
  const [productCode, setProductCode] = useState('')
  const [amount, setAmount] = useState('1000')
  const [clientCode, setClientCode] = useState('')
  const [order, setOrder] = useState('')

  const simulate = useMutation({
    mutationFn: () =>
      api.post<RoutingSimulation>('/admin/routing/simulate', {
        productCode,
        amountMinor: Math.round(Number(amount) * 100),
        clientCode: clientCode || undefined,
        providerOrder: order.trim() === '' ? undefined : order.split(',').map((code) => code.trim()),
      }),
  })

  return (
    <Panel title="Decision simulator" subtitle="Runs the routing rules without vending anything">
      <div className="grid-2">
        <Field
          label="Product code"
          placeholder="MTN_AIRTIME"
          value={productCode}
          onChange={(event) => setProductCode(event.target.value)}
        />
        <Field label="Amount" hint="Naira." value={amount} onChange={(event) => setAmount(event.target.value)} />
        <Field
          label="Client code"
          hint="Optional — client-scoped policies only apply when set."
          value={clientCode}
          onChange={(event) => setClientCode(event.target.value)}
        />
        <Field
          label="Try a provider order"
          hint="Optional, comma separated. Leave empty to see the decision as it stands."
          placeholder="MONNIFY, FLUTTERWAVE"
          value={order}
          onChange={(event) => setOrder(event.target.value)}
        />
      </div>

      <div style={{ marginTop: 'var(--space-4)' }}>
        <Button
          onClick={() => simulate.mutate()}
          loading={simulate.isPending}
          disabled={productCode.trim() === ''}
        >
          Simulate
        </Button>
      </div>

      {simulate.isError && (
        <Notice>
          {simulate.error instanceof ApiError ? simulate.error.message : 'The simulation could not be run.'}
        </Notice>
      )}

      {simulate.data && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Details>
            <Detail label="Would select">
              {simulate.data.selectedProviderCode ?? <Tag>none eligible</Tag>}
            </Detail>
            <Detail label="Ordered by">
              {simulate.data.simulatedOrder
                ? 'The order you entered — not applied'
                : simulate.data.policyVersion === null
                  ? 'Mapping priority; no policy applies'
                  : `Policy version ${simulate.data.policyVersion}`}
            </Detail>
          </Details>

          <div className="table-wrap" style={{ marginTop: 'var(--space-4)' }}>
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Outcome</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {simulate.data.candidates.map((candidate) => (
                  <tr key={candidate.providerCode}>
                    <td>{candidate.providerCode}</td>
                    <td>
                      {candidate.providerCode === simulate.data.selectedProviderCode ? (
                        <Tag tone="accent">selected</Tag>
                      ) : candidate.eligible ? (
                        <Tag tone="outline">eligible</Tag>
                      ) : (
                        <Tag>excluded</Tag>
                      )}
                    </td>
                    <td className="panel__subtitle">{candidate.reason ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </Panel>
  )
}
