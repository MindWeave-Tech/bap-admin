import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type {
  EnablementEvaluation,
  EnablementMatrix,
  ProviderCredentialSummary,
  ProviderDetail,
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
  Select,
  StatusTag,
  Tag,
} from '../components/ui'

const SCOPES = ['GLOBAL', 'COUNTRY', 'CATEGORY', 'BILLER', 'PRODUCT', 'CLIENT']

export function ProviderDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)
  const [changingStatus, setChangingStatus] = useState(false)
  const [addingCredential, setAddingCredential] = useState(false)
  const [addingRule, setAddingRule] = useState(false)

  const provider = useQuery({
    queryKey: ['provider', id],
    queryFn: () => api.get<ProviderDetail>(`/admin/providers/${id}`),
  })

  const credentials = useQuery({
    queryKey: ['provider-credentials', id],
    queryFn: () => api.get<ProviderCredentialSummary[]>(`/admin/providers/${id}/credentials`),
    enabled: can(Permission.ProviderCredentialsView),
  })

  const enablement = useQuery({
    queryKey: ['provider-enablement', id],
    queryFn: () => api.get<EnablementMatrix>(`/admin/providers/${id}/enablement`),
  })

  const refresh = () => {
    void queryClient.invalidateQueries({ queryKey: ['provider', id] })
    void queryClient.invalidateQueries({ queryKey: ['provider-credentials', id] })
    void queryClient.invalidateQueries({ queryKey: ['provider-enablement', id] })
    void queryClient.invalidateQueries({ queryKey: ['providers'] })
  }

  const act = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await run(action)
      refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The action failed.')
    }
  }

  if (provider.isPending) return <Loading label="Loading provider" />
  if (provider.isError) return <Notice>Could not load this provider.</Notice>

  const data = provider.data
  const mayToggle = can(Permission.ProvidersToggle)
  const mayManageCredentials = can(Permission.ProviderCredentialsManage)

  return (
    <Screen
      number="05"
      title={data.name}
      description={`${data.code} · ${data.environment} · adapter ${data.adapter}`}
      actions={
        mayToggle && data.allowedTransitions.length > 0 ? (
          <Button onClick={() => setChangingStatus(true)}>Change status</Button>
        ) : undefined
      }
    >
      <div className="stack">
        <Link to="/providers" style={{ fontSize: '13px' }}>
          ← All providers
        </Link>

        {error && <Notice>{error}</Notice>}

        {!data.acceptsNewTraffic && (
          <Notice title="Not receiving new traffic">
            {data.ineligibilityReason} Transactions already in flight are unaffected and still settle by requery.
          </Notice>
        )}

        {!data.capabilities.registered && (
          <Notice tone="neutral" title="No adapter registered">
            The profile names adapter <span className="mono">{data.adapter}</span>, but no implementation is
            registered. This provider cannot vend until the adapter ships.
          </Notice>
        )}

        <div className="grid-2">
          <Panel title="Profile">
            <Details>
              <Detail label="Status">
                <StatusTag status={data.status} />
                {/*
                  Said on the page rather than only in the change dialog: an
                  operator wondering why a provider is not serving should not
                  have to open a form to find out.
                */}
                {data.statusMeaning && <div className="panel__subtitle">{data.statusMeaning}</div>}
              </Detail>
              <Detail label="Accepting traffic">
                {data.acceptsNewTraffic ? 'Yes' : 'No'}
                {!data.acceptsNewTraffic && data.routeToService && (
                  <div className="panel__subtitle">{data.routeToService}</div>
                )}
              </Detail>
              <Detail label="Base URL">{data.baseUrl ?? 'Not set'}</Detail>
              <Detail label="Priority">{data.priority}</Detail>
              <Detail label="Timeouts">
                {data.connectTimeoutSeconds}s connect · {data.requestTimeoutSeconds}s request
              </Detail>
              <Detail label="Rate limit">
                {data.rateLimitPerMinute ? `${data.rateLimitPerMinute} per minute` : 'Not limited'}
              </Detail>
              <Detail label="Maintenance window">
                {data.maintenanceFrom
                  ? `${new Date(data.maintenanceFrom).toLocaleString()} → ${
                      data.maintenanceTo ? new Date(data.maintenanceTo).toLocaleString() : 'open ended'
                    }`
                  : 'None declared'}
              </Detail>
              <Detail label="Activated">
                {data.activatedAt ? new Date(data.activatedAt).toLocaleString() : 'Never'}
              </Detail>
            </Details>
          </Panel>

          <Panel
            title="Health"
            subtitle="What the traffic says, as distinct from the status somebody declared · PRD §12.16"
          >
            <Details>
              <Detail label="State">
                {data.health.state === 'HEALTHY' ? (
                  <Tag tone="outline">healthy</Tag>
                ) : data.health.state === 'UNKNOWN' ? (
                  <Tag>not enough data</Tag>
                ) : (
                  <Tag tone="accent">{data.health.state.toLowerCase().replaceAll('_', ' ')}</Tag>
                )}
                {data.health.override !== null && <Tag>pinned by hand</Tag>}
              </Detail>

              {data.health.override !== null && (
                <Detail label="Override">
                  {/* Both are shown: "healthy because somebody said so" and
                      "healthy because the traffic says so" are different
                      claims. */}
                  <div>{data.health.override.reason}</div>
                  <div className="panel__subtitle">
                    Set by {data.health.override.setBy ?? 'unknown'} · expires{' '}
                    {new Date(data.health.override.expiresAt).toLocaleString()}
                    {data.health.derivedState !== null && ` · metrics say ${data.health.derivedState.toLowerCase()}`}
                  </div>
                </Detail>
              )}

              <Detail label="Measured">
                {data.health.metrics === null || data.health.metrics.sampleSize === 0
                  ? 'No attempts in the window'
                  : `${data.health.metrics.failureRatePercent}% failed, ${data.health.metrics.timeoutRatePercent}% timed out, ${data.health.metrics.pendingRatePercent}% pending across ${data.health.metrics.sampleSize} attempts`}
              </Detail>

              <Detail label="Median latency">
                {data.health.metrics?.medianLatencyMs == null
                  ? '—'
                  : `${data.health.metrics.medianLatencyMs} ms`}
              </Detail>

              {data.health.evaluatedAt !== null && (
                <Detail label="Evaluated">{new Date(data.health.evaluatedAt).toLocaleString()}</Detail>
              )}
            </Details>
          </Panel>

          <Panel
            title="Circuit breaker"
            subtitle="Trips on measured health; withholds new transactions only · PRD §12.16"
          >
            <Details>
              <Detail label="State">
                {data.breaker.state === 'CLOSED' ? (
                  <Tag tone="outline">closed · admitting traffic</Tag>
                ) : data.breaker.state === 'HALF_OPEN' ? (
                  <Tag tone="accent">half-open · probing</Tag>
                ) : (
                  <Tag tone="accent">open · withholding new work</Tag>
                )}
              </Detail>
              <Detail label="Recent health">
                {data.breaker.sampleSize === 0
                  ? 'No attempts in the window'
                  : `${data.breaker.failureRatePercent}% failed, ${data.breaker.timeoutRatePercent}% timed out across ${data.breaker.sampleSize} attempts`}
              </Detail>
            </Details>
            {data.breaker.history.length > 0 && (
              <div className="stack" style={{ marginTop: 'var(--space-4)', gap: 'var(--space-2)' }}>
                {data.breaker.history.slice(0, 5).map((event) => (
                  <div key={event.occurredAt + event.to} style={{ fontSize: '13px' }}>
                    <span className="mono">
                      {event.from} → {event.to}
                    </span>
                    <div className="panel__subtitle">
                      {new Date(event.occurredAt).toLocaleString()} · {event.reason}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>

          <Panel title="Declared capabilities" subtitle="What the registered adapter says it supports · PRD §12.5">
            {data.capabilities.declared.length === 0 ? (
              <EmptyState title="Nothing declared">
                Capabilities appear once the adapter is registered in the application.
              </EmptyState>
            ) : (
              <div className="row">
                {data.capabilities.declared.map((capability) => (
                  <Tag key={capability} tone="accent">
                    {capability.replaceAll('_', ' ').toLowerCase()}
                  </Tag>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <Panel
          title="Credentials"
          subtitle="Values are never displayed. A fingerprint confirms which secret is loaded without exposing it."
          actions={
            mayManageCredentials ? (
              <Button variant="secondary" onClick={() => setAddingCredential(true)}>
                Add or rotate
              </Button>
            ) : undefined
          }
          flush
        >
          {!can(Permission.ProviderCredentialsView) ? (
            <EmptyState title="You do not have permission to view credential references" />
          ) : credentials.isPending ? (
            <Loading label="Loading credentials" />
          ) : (credentials.data?.length ?? 0) === 0 ? (
            <EmptyState title="No credentials loaded">
              This provider cannot authenticate upstream until its credentials are stored.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Fingerprint</th>
                    <th>Ver.</th>
                    <th>Status</th>
                    <th>Last used</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {credentials.data?.map((credential) => (
                    <tr key={credential.id}>
                      <td className="mono">{credential.name}</td>
                      <td className="mono">{credential.fingerprint ?? '—'}</td>
                      <td>{credential.version}</td>
                      <td>
                        <StatusTag status={credential.status} />
                      </td>
                      <td className="panel__subtitle">
                        {credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString() : 'Never'}
                      </td>
                      <td>
                        {mayManageCredentials && credential.status === 'active' && credential.version > 1 && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void act(() =>
                                api.post(`/admin/providers/${data.id}/credentials/${credential.name}/rollback`),
                              )
                            }
                          >
                            Roll back
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

        <Panel
          title="Enablement matrix"
          subtitle={
            enablement.data?.policy === 'authoritative_disable'
              ? 'A disable at any level wins over a more specific enable — turning a provider off cannot be undone by a forgotten lower-level rule.'
              : 'The most specific rule wins outright, whichever way it points.'
          }
          actions={
            mayToggle ? (
              <Button variant="secondary" onClick={() => setAddingRule(true)}>
                Add rule
              </Button>
            ) : undefined
          }
          flush
        >
          {enablement.isPending ? (
            <Loading label="Loading enablement" />
          ) : (enablement.data?.rules.length ?? 0) === 0 ? (
            <EmptyState title="No rules — the provider is enabled everywhere">
              Add a rule to disable it for a country, category, biller, product or client.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Scope</th>
                    <th>Value</th>
                    <th>Enabled</th>
                    <th>Reason</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {enablement.data?.rules.map((rule) => (
                    <tr key={rule.id}>
                      <td>{rule.scope}</td>
                      <td className="mono">{rule.scopeValue ?? '—'}</td>
                      <td>{rule.enabled ? <Tag tone="accent">enabled</Tag> : <Tag>disabled</Tag>}</td>
                      <td className="panel__subtitle">{rule.reason ?? '—'}</td>
                      <td>
                        {mayToggle && (
                          <Button
                            variant="ghost"
                            onClick={() =>
                              void act(() =>
                                api.delete(`/admin/providers/${data.id}/enablement`, {
                                  scope: rule.scope,
                                  scopeValue: rule.scopeValue,
                                }),
                              )
                            }
                          >
                            Clear
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

        <EnablementEvaluator providerId={data.id} />
      </div>

      {changingStatus && (
        <StatusDialog
          allowed={data.allowedTransitions}
          routeToService={data.routeToService}
          onClose={() => setChangingStatus(false)}
          onConfirm={async (status, reason) => {
            setChangingStatus(false)
            await act(() => api.post(`/admin/providers/${data.id}/status`, { status, reason }))
          }}
        />
      )}

      {addingCredential && (
        <CredentialDialog
          onClose={() => setAddingCredential(false)}
          onConfirm={async (name, value) => {
            setAddingCredential(false)
            await act(() => api.post(`/admin/providers/${data.id}/credentials`, { name, value }))
          }}
        />
      )}

      {addingRule && (
        <RuleDialog
          onClose={() => setAddingRule(false)}
          onConfirm={async (scope, scopeValue, enabled, reason) => {
            setAddingRule(false)
            await act(() =>
              api.post(`/admin/providers/${data.id}/enablement`, { scope, scopeValue, enabled, reason }),
            )
          }}
        />
      )}

      {confirmDialog}
    </Screen>
  )
}

/** Answers whether this provider would serve a given vend, and why. */
function EnablementEvaluator({ providerId }: { providerId: number }) {
  const [form, setForm] = useState({ country: 'NG', categoryCode: '', billerCode: '', productCode: '', clientCode: '' })
  const [result, setResult] = useState<EnablementEvaluation | null>(null)
  const [busy, setBusy] = useState(false)

  const evaluate = async () => {
    setBusy(true)
    try {
      setResult(await api.post<EnablementEvaluation>(`/admin/providers/${providerId}/enablement/evaluate`, form))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Would this provider serve a vend?" subtitle="Evaluates the rules without vending anything">
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          void evaluate()
        }}
      >
        <div className="grid-3">
          <Field label="Country" value={form.country} onChange={(e) => setForm({ ...form, country: e.target.value })} />
          <Field
            label="Category"
            value={form.categoryCode}
            onChange={(e) => setForm({ ...form, categoryCode: e.target.value })}
          />
          <Field
            label="Biller"
            value={form.billerCode}
            onChange={(e) => setForm({ ...form, billerCode: e.target.value })}
          />
          <Field
            label="Product"
            value={form.productCode}
            onChange={(e) => setForm({ ...form, productCode: e.target.value })}
          />
          <Field
            label="Client code"
            value={form.clientCode}
            onChange={(e) => setForm({ ...form, clientCode: e.target.value })}
          />
        </div>
        <div>
          <Button type="submit" loading={busy}>
            Evaluate
          </Button>
        </div>
      </form>

      {result && (
        <div style={{ marginTop: 'var(--space-4)' }}>
          <Notice tone={result.wouldServe ? 'neutral' : 'accent'} title={result.wouldServe ? 'Would serve' : 'Would not serve'}>
            {result.reason}
            {!result.providerAcceptsTraffic && result.providerIneligibilityReason
              ? ` ${result.providerIneligibilityReason}`
              : ''}
          </Notice>
        </div>
      )}
    </Panel>
  )
}

function StatusDialog({
  allowed,
  routeToService,
  onClose,
  onConfirm,
}: {
  allowed: string[]
  routeToService?: string | null
  onClose: () => void
  onConfirm: (status: string, reason: string) => Promise<void>
}) {
  const [status, setStatus] = useState(allowed[0] ?? '')
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Dialog
      title="Change provider status"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={reason.trim() === '' || status === ''}
            onClick={() => {
              setBusy(true)
              void onConfirm(status, reason).finally(() => setBusy(false))
            }}
          >
            Change status
          </Button>
        </>
      }
    >
      <p>Only transitions the lifecycle allows are listed. The reason is recorded in the audit trail.</p>
      {routeToService && (
        // A list of what is permitted does not tell somebody what to do. This is
        // the answer to "why can I not just switch it on?", which is the first
        // thing a newly created provider prompts.
        <Notice tone="neutral">{routeToService}</Notice>
      )}
      <Select label="New status" value={status} onChange={setStatus}>
        {allowed.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Select>
      <Field label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
    </Dialog>
  )
}

function CredentialDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (name: string, value: string) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)

  return (
    <Dialog
      title="Add or rotate a credential"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={name.trim() === '' || value === ''}
            onClick={() => {
              setBusy(true)
              void onConfirm(name, value).finally(() => setBusy(false))
            }}
          >
            Store
          </Button>
        </>
      }
    >
      <Notice tone="neutral">
        Storing a name that already exists rotates it — the previous version is kept and can be rolled back. On a
        server, prefer <span className="mono">php artisan provider:credential</span>, which prompts rather than
        putting the secret in a browser.
      </Notice>
      <Field
        label="Name"
        hint="Lower case with underscores, for example secret_key."
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Field
        label="Value"
        type="password"
        autoComplete="off"
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
    </Dialog>
  )
}

function RuleDialog({
  onClose,
  onConfirm,
}: {
  onClose: () => void
  onConfirm: (scope: string, scopeValue: string | null, enabled: boolean, reason: string) => Promise<void>
}) {
  const [scope, setScope] = useState('GLOBAL')
  const [scopeValue, setScopeValue] = useState('')
  const [enabled, setEnabled] = useState(false)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const needsValue = scope !== 'GLOBAL'

  return (
    <Dialog
      title="Add enablement rule"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button
            loading={busy}
            disabled={needsValue && scopeValue.trim() === ''}
            onClick={() => {
              setBusy(true)
              void onConfirm(scope, needsValue ? scopeValue : null, enabled, reason).finally(() => setBusy(false))
            }}
          >
            Save rule
          </Button>
        </>
      }
    >
      <Select label="Scope" value={scope} onChange={setScope}>
        {SCOPES.map((value) => (
          <option key={value} value={value}>
            {value}
          </option>
        ))}
      </Select>
      {needsValue && (
        <Field
          label="Scope value"
          hint="The country, category, biller, product or client code this rule applies to."
          value={scopeValue}
          onChange={(event) => setScopeValue(event.target.value)}
        />
      )}
      <Select label="Effect" value={enabled ? 'enabled' : 'disabled'} onChange={(v) => setEnabled(v === 'enabled')}>
        <option value="disabled">Disabled</option>
        <option value="enabled">Enabled</option>
      </Select>
      <Field label="Reason" value={reason} onChange={(event) => setReason(event.target.value)} />
    </Dialog>
  )
}
