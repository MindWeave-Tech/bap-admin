import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { CatalogCategoryNode, CatalogSyncItem, CatalogSyncRun } from '../lib/types'
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
  Tag,
} from '../components/ui'

const CHANGE_TONE: Record<string, 'accent' | 'outline' | 'neutral'> = {
  NEW: 'accent',
  CHANGED: 'outline',
  REMOVED: 'neutral',
}

/** Renders one field-level difference without pretending to know its type. */
function value(raw: unknown): string {
  if (raw === null || raw === undefined) return '—'

  return typeof raw === 'object' ? JSON.stringify(raw) : String(raw)
}

export function CatalogSyncPage() {
  const { can } = useAuth()
  const queryClient = useQueryClient()
  const { run: confirmed, dialog: confirmDialog } = useConfirmedAction()

  const [error, setError] = useState<string | null>(null)
  const [reviewing, setReviewing] = useState<CatalogSyncItem | null>(null)
  const [productCode, setProductCode] = useState('')
  const [note, setNote] = useState('')

  const mayPublish = can(Permission.CatalogPublish)
  const mayRun = can(Permission.CatalogManage)

  const runs = useQuery({
    queryKey: ['catalog', 'sync-runs'],
    queryFn: () => api.get<CatalogSyncRun[]>('/admin/catalog/sync-runs'),
  })

  const items = useQuery({
    queryKey: ['catalog', 'sync-items'],
    queryFn: () => api.get<CatalogSyncItem[]>('/admin/catalog/sync-items'),
  })

  // Only needed to pick the internal product a NEW item maps to.
  const tree = useQuery({
    queryKey: ['catalog', 'tree'],
    queryFn: () => api.get<CatalogCategoryNode[]>('/admin/catalog/tree'),
    enabled: mayPublish,
  })

  const refresh = () => void queryClient.invalidateQueries({ queryKey: ['catalog'] })

  const synchronize = useMutation({
    mutationFn: (providerCode: string) => api.post<CatalogSyncRun>('/admin/catalog/sync', { providerCode }),
    onSuccess: refresh,
  })

  const decide = async (decision: 'approve' | 'reject') => {
    if (reviewing === null) return

    setError(null)

    if (decision === 'approve' && reviewing.requiresProductChoice && productCode === '') {
      setError('Choose the internal product this provider product maps to.')

      return
    }

    if (decision === 'reject' && note.trim() === '') {
      setError('A rejection needs a reason — it is what someone reads when the item comes back next sync.')

      return
    }

    try {
      await confirmed(() =>
        api.post(`/admin/catalog/sync-items/${reviewing.id}/${decision}`, {
          productCode: decision === 'approve' && productCode !== '' ? productCode : undefined,
          note: note.trim() === '' ? undefined : note.trim(),
        }),
      )
      setReviewing(null)
      setProductCode('')
      setNote('')
      refresh()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'The decision could not be recorded.')
    }
  }

  if (runs.isPending || items.isPending) return <Loading label="Loading catalog sync" />
  if (runs.isError || items.isError) return <Notice>Could not load catalog synchronisation.</Notice>

  const pending = items.data
  const providers = [...new Set(runs.data.map((r) => r.providerCode))]

  const products = (tree.data ?? []).flatMap((category) =>
    (category.billers ?? []).flatMap((biller) =>
      (biller.products ?? []).map((product) => ({
        code: product.code,
        label: `${category.code} · ${biller.code} · ${product.code}`,
      })),
    ),
  )

  return (
    <Screen
      number="07"
      title="Catalog synchronisation"
      description="A run proposes; nothing reaches live traffic without a person · PRD §12.4"
      actions={
        mayRun && (
          <>
            {providers.length === 0 && <Tag>no runs yet</Tag>}
            {providers.map((code) => (
              <Button
                key={code}
                variant="secondary"
                loading={synchronize.isPending}
                onClick={() => synchronize.mutate(code)}
              >
                Sync {code}
              </Button>
            ))}
          </>
        )
      }
    >
      <div className="stack">
        {error && <Notice>{error}</Notice>}

        {synchronize.isError && (
          <Notice>
            {synchronize.error instanceof ApiError ? synchronize.error.message : 'The run could not be started.'}
          </Notice>
        )}

        {pending.length > 0 && !mayPublish && (
          <Notice title={`${pending.length} item${pending.length === 1 ? '' : 's'} awaiting review`}>
            Approving a catalog change repoints live traffic, so it needs the{' '}
            <span className="mono">catalog.publish</span> permission, which your role does not hold.
          </Notice>
        )}

        <Panel
          title="Review queue"
          subtitle="Provider changes waiting on a decision. Nothing here is live yet"
          flush
        >
          {pending.length === 0 ? (
            <EmptyState title="Nothing awaiting review">
              Every proposed change has been decided. Run a synchronisation to check for new ones.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Change</th>
                    <th>Provider product</th>
                    <th>Maps to</th>
                    <th>What moved</th>
                    {mayPublish && <th />}
                  </tr>
                </thead>
                <tbody>
                  {pending.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Tag tone={CHANGE_TONE[item.changeType] ?? 'neutral'}>{item.changeType.toLowerCase()}</Tag>
                      </td>
                      <td>
                        <div className="mono">{item.providerProductCode}</div>
                        <div className="panel__subtitle">
                          {item.providerProductName ?? '—'}
                          {item.providerBillerCode && ` · ${item.providerBillerCode}`}
                        </div>
                      </td>
                      <td className="panel__subtitle">
                        {item.suggestedProduct ? (
                          <span className="mono">{item.suggestedProduct.code}</span>
                        ) : item.requiresProductChoice ? (
                          <Tag>needs a product</Tag>
                        ) : item.currentMapping ? (
                          <span className="mono">mapping v{item.currentMapping.version}</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="panel__subtitle">
                        {Object.keys(item.differences).length === 0
                          ? '—'
                          : Object.keys(item.differences).join(', ')}
                      </td>
                      {mayPublish && (
                        <td style={{ textAlign: 'right' }}>
                          <Button
                            variant="secondary"
                            onClick={() => {
                              setReviewing(item)
                              setProductCode(item.suggestedProduct?.code ?? '')
                              setNote('')
                              setError(null)
                            }}
                          >
                            Review
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

        <Panel title="Run history" subtitle="What each synchronisation found, and what it left waiting" flush>
          {runs.data.length === 0 ? (
            <EmptyState title="No synchronisation has run yet" />
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Provider</th>
                    <th>Outcome</th>
                    <th style={{ textAlign: 'right' }}>New</th>
                    <th style={{ textAlign: 'right' }}>Changed</th>
                    <th style={{ textAlign: 'right' }}>Removed</th>
                    <th style={{ textAlign: 'right' }}>Unchanged</th>
                    <th style={{ textAlign: 'right' }}>Awaiting</th>
                    <th>Started</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.data.map((run) => (
                    <tr key={run.id}>
                      <td>
                        <div>{run.providerCode}</div>
                        <div className="panel__subtitle">{run.environment}</div>
                      </td>
                      <td>
                        {run.status === 'FAILED' ? (
                          <>
                            <Tag tone="accent">failed</Tag>
                            <div className="panel__subtitle">{run.errorMessage}</div>
                          </>
                        ) : (
                          <Tag tone="outline">{run.status.toLowerCase()}</Tag>
                        )}
                      </td>
                      <td className="mono" style={{ textAlign: 'right' }}>{run.counts.new}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{run.counts.changed}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>{run.counts.removed}</td>
                      <td className="mono" style={{ textAlign: 'right', opacity: 0.5 }}>{run.counts.unchanged}</td>
                      <td className="mono" style={{ textAlign: 'right' }}>
                        {run.pendingItems > 0 ? <Tag tone="accent">{run.pendingItems}</Tag> : 0}
                      </td>
                      <td className="panel__subtitle">{new Date(run.startedAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Panel>

        <p className="panel__subtitle">
          Looking for what is already live? <Link to="/catalog">The catalog and its mappings →</Link>
        </p>
      </div>

      {reviewing !== null && (
        <Dialog
          title={`${reviewing.changeType.toLowerCase()} · ${reviewing.providerProductCode}`}
          onClose={() => setReviewing(null)}
          footer={
            <>
              <Button variant="secondary" onClick={() => void decide('reject')}>
                Reject
              </Button>
              <Button onClick={() => void decide('approve')}>Approve</Button>
            </>
          }
        >
          <Details>
            <Detail label="Provider">
              {reviewing.providerCode} · {reviewing.environment}
            </Detail>
            <Detail label="Product name">{reviewing.providerProductName ?? '—'}</Detail>
            {reviewing.currentMapping && (
              <Detail label="Current mapping">
                v{reviewing.currentMapping.version} — approving opens v{reviewing.currentMapping.version + 1} and
                closes this one
              </Detail>
            )}
          </Details>

          {Object.keys(reviewing.differences).length > 0 && (
            <div className="table-wrap" style={{ marginTop: 'var(--space-4)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Was</th>
                    <th>Becomes</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(reviewing.differences).map(([field, change]) => (
                    <tr key={field}>
                      <td className="mono">{field}</td>
                      <td className="panel__subtitle">{value(change.from)}</td>
                      <td className="mono">{value(change.to)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {reviewing.changeType === 'NEW' && (
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Select label="Internal product" value={productCode} onChange={setProductCode}>
                <option value="">Choose a product…</option>
                {products.map((product) => (
                  <option key={product.code} value={product.code}>
                    {product.label}
                  </option>
                ))}
              </Select>
              <p className="panel__subtitle">
                Which platform product this provider product fulfils. Required, and it is what keeps the provider's
                own code out of every client response.
              </p>
            </div>
          )}

          <Field
            label="Note"
            hint="Required when rejecting; recorded either way."
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Dialog>
      )}

      {confirmDialog}
    </Screen>
  )
}
