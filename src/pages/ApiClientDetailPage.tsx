import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ApiClientSummary, IssuedCredential } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { useConfirmedAction } from '../lib/useConfirmedAction'
import { Notice, Tag, Button, Panel, Dialog, EmptyState, Field, Loading, StatusTag } from '../components/ui'
import { Screen } from '../components/layout/Screen'

export function ApiClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run, dialog: confirmDialog } = useConfirmedAction()

  const [issuing, setIssuing] = useState(false)
  const [issued, setIssued] = useState<IssuedCredential | null>(null)
  const [error, setError] = useState<string | null>(null)

  const client = useQuery({
    queryKey: ['api-clients', id],
    queryFn: () => api.get<ApiClientSummary>(`/admin/api-clients/${id}`),
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['api-clients'] })
  const mayManageCredentials = can(Permission.ApiCredentialsManage)

  const act = async (action: () => Promise<unknown>) => {
    setError(null)
    try {
      await run(action)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The action failed.')
    }
  }

  if (client.isPending) return <Loading label="Loading client" />
  if (client.isError) return <Notice>Could not load this API client.</Notice>

  const data = client.data

  return (
      <Screen number="09"
        title={data.name}
        description={`Client code ${data.code} · ${data.clientType} · ${data.environment}`}
        actions={
          mayManageCredentials ? <Button onClick={() => setIssuing(true)}>Issue credential</Button> : undefined
        }
      >

      <div className="stack">
        <Link to="/api-clients" className="panel__subtitle">
          ← Back to API clients
        </Link>

        {error && <Notice>{error}</Notice>}

        <div className="grid-2">
          <Panel title="Configuration">
            <dl className="stack" style={{ margin: 0 }}>
              <Detail label="Status" value={<StatusTag status={data.status} />} />
              <Detail label="Tenant" value={data.tenant ?? 'None'} />
              <Detail label="Callback URL" value={data.callbackUrl ?? 'Not configured'} />
              <Detail
                label="Allowed source addresses"
                value={data.allowedIps.length ? data.allowedIps.join(', ') : 'Any address'}
              />
              <Detail label="Expires" value={data.expiresAt ? new Date(data.expiresAt).toLocaleString() : 'Never'} />
            </dl>
          </Panel>

          <Panel title="Limits and access">
            <dl className="stack" style={{ margin: 0 }}>
              <Detail
                label="Rate limit"
                value={data.rateLimitPerMinute ? `${data.rateLimitPerMinute} requests per minute` : 'Not limited'}
              />
              <Detail
                label="Daily transactions"
                value={data.dailyTransactionLimit ? `${data.dailyTransactionLimit} per day` : 'Not limited'}
              />
              <Detail
                label="Daily value"
                value={
                  data.dailyAmountLimitMinor
                    ? `₦${(data.dailyAmountLimitMinor / 100).toLocaleString()} per day`
                    : 'Not limited'
                }
              />
              <Detail
                label="Service access"
                value={
                  data.allowedCategoryCodes.length || data.allowedBillerCodes.length || data.allowedProductCodes.length
                    ? [...data.allowedCategoryCodes, ...data.allowedBillerCodes, ...data.allowedProductCodes].join(', ')
                    : 'All enabled services'
                }
              />
              <Detail
                label="Callback events"
                value={data.callbackEvents.length ? data.callbackEvents.join(', ') : 'All events'}
              />
            </dl>
          </Panel>
        </div>

        <Panel
          title="Credentials"
          subtitle="Secrets are shown once at creation and cannot be retrieved afterwards."
          flush
        >
          {data.credentials.length === 0 ? (
            <EmptyState title="No credentials issued">
              This client cannot call the API until a credential is issued.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Key ID</th>
                    <th>Scopes</th>
                    <th>Status</th>
                    <th>Last used</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {data.credentials.map((credential) => (
                    <tr key={credential.id}>
                      <td>{credential.name}</td>
                      <td className="mono">{credential.keyId}</td>
                      <td>
                        <div className="row">
                          {(credential.scopes ?? ['*']).map((scope) => (
                            <Tag key={scope}>{scope}</Tag>
                          ))}
                        </div>
                      </td>
                      <td>
                        <StatusTag status={credential.status} />
                      </td>
                      <td className="panel__subtitle">
                        {credential.lastUsedAt ? new Date(credential.lastUsedAt).toLocaleString() : 'Never'}
                      </td>
                      <td>
                        {mayManageCredentials && credential.status === 'active' && (
                          <div className="row">
                            <Button
                              variant="secondary"
                              
                              onClick={() =>
                                void act(async () => {
                                  const result = await api.post<IssuedCredential>(
                                    `/admin/api-clients/${data.id}/credentials/${credential.id}/rotate`,
                                  )
                                  setIssued(result)
                                  refresh()
                                })
                              }
                            >
                              Rotate
                            </Button>
                            <Button
                              variant="ghost"
                              
                              onClick={() => {
                                if (!window.confirm(`Revoke credential ${credential.keyId}? This cannot be undone.`))
                                  return
                                void act(async () => {
                                  await api.delete(`/admin/api-clients/${data.id}/credentials/${credential.id}`)
                                  refresh()
                                })
                              }}
                            >
                              Revoke
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>
      </div>

      {issuing && (
        <IssueCredentialDialog
          onClose={() => setIssuing(false)}
          onIssue={async (name, scopes) => {
            setIssuing(false)
            await act(async () => {
              const result = await api.post<IssuedCredential>(`/admin/api-clients/${data.id}/credentials`, {
                name,
                scopes,
              })
              setIssued(result)
              refresh()
            })
          }}
        />
      )}

      {issued && (
        <Dialog
          title="Credential issued"
          onClose={() => setIssued(null)}
          footer={<Button onClick={() => setIssued(null)}>I have stored it</Button>}
        >
          <Notice tone="accent" title="Copy this secret now">
            It is shown once and cannot be retrieved later. If it is lost, rotate the credential.
          </Notice>
          <code className="secret">{issued.secret}</code>
          <p className="panel__subtitle">
            Key ID <span className="mono">{issued.keyId}</span> is safe to record in your configuration and logs.
          </p>
        </Dialog>
      )}

      {confirmDialog}
    </Screen>
  )
}

function Detail({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="panel__subtitle" style={{ fontSize: 12 }}>
        {label}
      </dt>
      <dd style={{ margin: 0 }}>{value}</dd>
    </div>
  )
}

function IssueCredentialDialog({
  onClose,
  onIssue,
}: {
  onClose: () => void
  onIssue: (name: string, scopes: string[]) => Promise<void>
}) {
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState('*')
  const [busy, setBusy] = useState(false)

  const submit = async () => {
    setBusy(true)
    await onIssue(
      name,
      scopes
        .split(',')
        .map((scope) => scope.trim())
        .filter(Boolean),
    )
    setBusy(false)
  }

  return (
    <Dialog
      title="Issue credential"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void submit()} loading={busy}>
            Issue
          </Button>
        </>
      }
    >
      <Field
        label="Name"
        hint="How this credential will be recognised, for example primary or ci-pipeline."
        value={name}
        onChange={(event) => setName(event.target.value)}
      />
      <Field
        label="Scopes"
        hint="Comma separated. Use * for unrestricted access."
        value={scopes}
        onChange={(event) => setScopes(event.target.value)}
      />
    </Dialog>
  )
}
