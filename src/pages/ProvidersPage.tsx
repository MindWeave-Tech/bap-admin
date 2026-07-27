import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { ProviderSummary } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Permission } from '../lib/permissions'
import { Screen } from '../components/layout/Screen'
import { Button, Dialog, EmptyState, Field, Loading, Notice, Panel, Select, StatusTag, Tag } from '../components/ui'

export function ProvidersPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)

  const providers = useQuery({
    queryKey: ['providers'],
    queryFn: () => api.get<ProviderSummary[]>('/admin/providers'),
  })

  return (
    <Screen
      number="05"
      title="Providers"
      description="Upstream aggregators and their lifecycle. Only an ACTIVE provider outside a maintenance window receives new vending traffic; transactions already in flight are never disturbed."
      actions={
        can(Permission.ProvidersManage) ? <Button onClick={() => setCreating(true)}>Add provider</Button> : undefined
      }
    >
      <Panel flush>
        {providers.isPending ? (
          <Loading label="Loading providers" />
        ) : providers.isError ? (
          <div className="panel__body">
            <Notice>Could not load providers.</Notice>
          </div>
        ) : providers.data.length === 0 ? (
          <EmptyState title="No providers registered">
            Register Monnify or Flutterwave to begin. A provider starts in DRAFT and reaches ACTIVE through its
            lifecycle.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Provider</th>
                  <th>Environment</th>
                  <th>Adapter</th>
                  <th>Status</th>
                  <th>Traffic</th>
                  <th>Priority</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {providers.data.map((provider) => (
                  <tr key={provider.id}>
                    <td>
                      <div style={{ fontWeight: 500 }}>{provider.name}</div>
                      <div className="panel__subtitle mono">{provider.code}</div>
                    </td>
                    <td>
                      <StatusTag status={provider.environment} />
                    </td>
                    <td className="mono">{provider.adapter}</td>
                    <td>
                      <StatusTag status={provider.status} />
                    </td>
                    <td>
                      {provider.acceptsNewTraffic ? (
                        <Tag tone="accent">accepting</Tag>
                      ) : (
                        <>
                          <Tag>excluded</Tag>
                          <div className="panel__subtitle">{provider.ineligibilityReason}</div>
                        </>
                      )}
                    </td>
                    <td className="mono">{provider.priority}</td>
                    <td>
                      <Link to={`/providers/${provider.id}`}>Manage</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>

      {creating && (
        <CreateProviderDialog
          onClose={() => setCreating(false)}
          onCreated={() => {
            setCreating(false)
            void queryClient.invalidateQueries({ queryKey: ['providers'] })
          }}
        />
      )}
    </Screen>
  )
}

function CreateProviderDialog({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    code: '',
    name: '',
    adapter: '',
    environment: 'sandbox',
    base_url: '',
  })

  const mutation = useMutation({
    mutationFn: () => api.post<ProviderSummary>('/admin/providers', { ...form, base_url: form.base_url || null }),
    onSuccess: onCreated,
  })

  const fieldErrors = mutation.error instanceof ApiError ? mutation.error.fieldErrors() : {}

  return (
    <Dialog
      title="Add provider"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Create
          </Button>
        </>
      }
    >
      <p>
        The provider is created in <strong>DRAFT</strong>. Load its credentials, then move it through TESTING to
        ACTIVE.
      </p>
      {mutation.isError && Object.keys(fieldErrors).length === 0 && (
        <Notice>{mutation.error instanceof ApiError ? mutation.error.message : 'Could not create the provider.'}</Notice>
      )}
      <Field
        label="Code"
        hint="Stable identifier, for example MONNIFY. Unique per environment."
        value={form.code}
        error={fieldErrors.code}
        onChange={(event) => setForm({ ...form, code: event.target.value.toUpperCase() })}
      />
      <Field
        label="Name"
        value={form.name}
        error={fieldErrors.name}
        onChange={(event) => setForm({ ...form, name: event.target.value })}
      />
      <Field
        label="Adapter"
        hint="The integration that implements this provider, for example monnify."
        value={form.adapter}
        error={fieldErrors.adapter}
        onChange={(event) => setForm({ ...form, adapter: event.target.value })}
      />
      <Select
        label="Environment"
        value={form.environment}
        onChange={(value) => setForm({ ...form, environment: value })}
      >
        <option value="sandbox">Sandbox</option>
        <option value="production">Production</option>
      </Select>
      <Field
        label="Base URL"
        hint="For example https://sandbox.monnify.com"
        value={form.base_url}
        error={fieldErrors.base_url}
        onChange={(event) => setForm({ ...form, base_url: event.target.value })}
      />
    </Dialog>
  )
}
