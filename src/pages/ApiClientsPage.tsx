import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ApiClientSummary } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { Alert, Button, Card, Dialog, EmptyState, Field, Loading, StatusBadge } from '../components/ui'
import { PageHeader } from '../components/layout/PageHeader'

export function ApiClientsPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  const clients = useQuery({
    queryKey: ['api-clients'],
    queryFn: () => api.get<ApiClientSummary[]>('/admin/api-clients'),
  })

  return (
    <>
      <PageHeader
        title="API clients"
        description="Registered consumers of the vending API, their service access, limits, and credentials."
        actions={
          can(Permission.ApiClientsManage) ? <Button onClick={() => setCreating(true)}>Add client</Button> : undefined
        }
      />

      <Card bodyless>
        {clients.isPending ? (
          <Loading label="Loading clients" />
        ) : clients.isError ? (
          <div style={{ padding: 16 }}>
            <Alert>Could not load API clients.</Alert>
          </div>
        ) : clients.data.length === 0 ? (
          <EmptyState title="No API clients yet">
            Register Ledgria, Invo, or another internal service to begin vending.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Client</th>
                  <th>Type</th>
                  <th>Environment</th>
                  <th>Status</th>
                  <th>Credentials</th>
                  <th>Limits</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {clients.data.map((client) => (
                  <tr key={client.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{client.name}</div>
                      <div className="muted mono">{client.code}</div>
                    </td>
                    <td>{client.clientType}</td>
                    <td>
                      <StatusBadge status={client.environment} />
                    </td>
                    <td>
                      <StatusBadge status={client.status} />
                    </td>
                    <td>{client.credentials.filter((credential) => credential.status === 'active').length} active</td>
                    <td className="muted">
                      {client.rateLimitPerMinute ? `${client.rateLimitPerMinute}/min` : 'No rate limit'}
                      {client.dailyTransactionLimit ? ` · ${client.dailyTransactionLimit}/day` : ''}
                    </td>
                    <td>
                      <Link to={`/api-clients/${client.id}`}>Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {creating && (
        <CreateClientDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void queryClient.invalidateQueries({ queryKey: ['api-clients'] })
          }}
        />
      )}
    </>
  )
}

function CreateClientDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    client_type: 'internal',
    environment: 'sandbox',
    callback_url: '',
  })

  const mutation = useMutation({
    mutationFn: () =>
      api.post<ApiClientSummary>('/admin/api-clients', {
        ...form,
        callback_url: form.callback_url || null,
      }),
    onSuccess: onCreated,
  })

  const fieldErrors = mutation.error instanceof ApiError ? mutation.error.fieldErrors() : {}
  const update = (key: keyof typeof form) => (value: string) => setForm({ ...form, [key]: value })

  return (
    <Dialog
      title="Add API client"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Create client
          </Button>
        </>
      }
    >
      {mutation.isError && Object.keys(fieldErrors).length === 0 && (
        <Alert>{mutation.error instanceof ApiError ? mutation.error.message : 'Could not create the client.'}</Alert>
      )}
      <Field
        label="Code"
        hint="Stable identifier used in logs and reports, for example ledgria."
        value={form.code}
        error={fieldErrors.code}
        onChange={(event) => update('code')(event.target.value)}
      />
      <Field
        label="Name"
        value={form.name}
        error={fieldErrors.name}
        onChange={(event) => update('name')(event.target.value)}
      />
      <div className="field">
        <label className="field__label" htmlFor="client-type">
          Client type
        </label>
        <select
          id="client-type"
          className="select"
          value={form.client_type}
          onChange={(event) => update('client_type')(event.target.value)}
        >
          <option value="internal">Internal</option>
          <option value="reseller">Reseller</option>
          <option value="system">System</option>
          <option value="test">Test</option>
        </select>
      </div>
      <div className="field">
        <label className="field__label" htmlFor="client-environment">
          Environment
        </label>
        <select
          id="client-environment"
          className="select"
          value={form.environment}
          onChange={(event) => update('environment')(event.target.value)}
        >
          <option value="sandbox">Sandbox</option>
          <option value="production">Production</option>
        </select>
      </div>
      <Field
        label="Callback URL"
        hint="Optional. Setting one generates a signing secret for asynchronous transaction callbacks."
        value={form.callback_url}
        error={fieldErrors.callback_url}
        onChange={(event) => update('callback_url')(event.target.value)}
      />
    </Dialog>
  )
}
