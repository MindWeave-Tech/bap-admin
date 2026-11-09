import { useState } from 'react'
import { Link } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { CatalogCategoryNode, CatalogSyncItem, CatalogSyncRun, NewProductDraft } from '../lib/types'
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

function naira(minor: number): string {
  return `₦${(minor / 100).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
}

/** "250,000" or "1500.50" to kobo; null for anything that is not a positive amount. */
function parseNaira(text: string): number | null {
  const cleaned = text.replace(/[,\s₦]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null

  const minor = Math.round(Number(cleaned) * 100)

  return minor > 0 ? minor : null
}

/** What the provider charges, as a reviewer would say it. */
function price(item: CatalogSyncItem): string | null {
  const { fixedAmountMinor, minimumAmountMinor, maximumAmountMinor } = item.providerPayload

  if (fixedAmountMinor) return naira(fixedAmountMinor)
  if (minimumAmountMinor && maximumAmountMinor) return `${naira(minimumAmountMinor)} – ${naira(maximumAmountMinor)}`

  return null
}

/**
 * A platform code from a product's name: "MTN 1.5 GB" under MTN_DATA becomes
 * MTN_1_5_GB. Prefixed with the biller's code only when the name does not
 * already start with it, so the code says whose product it is without
 * repeating it.
 */
function codeFor(billerCode: string, name: string): string {
  const slug = name
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
  const owner = billerCode.split('_')[0]

  if (slug === '') return billerCode

  return slug.startsWith(`${owner}_`) || slug === owner ? slug : `${billerCode}_${slug}`
}

interface NewProductForm {
  billerCode: string
  name: string
  code: string
  codeEdited: boolean
  amountType: 'FIXED' | 'VARIABLE'
  fixed: string
  minimum: string
  maximum: string
}

function newProductForm(item: CatalogSyncItem): NewProductForm {
  const { fixedAmountMinor, minimumAmountMinor, maximumAmountMinor } = item.providerPayload
  const billerCode = item.suggestedBillerCode ?? ''
  const name = item.providerProductName ?? ''
  const toNaira = (minor: number | null | undefined) => (minor ? String(minor / 100) : '')

  return {
    billerCode,
    name,
    code: billerCode === '' ? '' : codeFor(billerCode, name),
    codeEdited: false,
    amountType: fixedAmountMinor ? 'FIXED' : 'VARIABLE',
    fixed: toNaira(fixedAmountMinor),
    minimum: toNaira(minimumAmountMinor),
    maximum: toNaira(maximumAmountMinor),
  }
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
  const [mode, setMode] = useState<'existing' | 'new'>('existing')
  const [draft, setDraft] = useState<NewProductForm | null>(null)
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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

  const open = (item: CatalogSyncItem) => {
    setReviewing(item)
    setProductCode(item.suggestedProduct?.code ?? '')
    setDraft(newProductForm(item))
    // A fixed-price plan or bouquet almost never exists internally yet; an
    // open-amount product (airtime, electricity) almost always does.
    setMode(item.suggestedProduct === null && item.providerPayload.fixedAmountMinor ? 'new' : 'existing')
    setFieldErrors({})
    setNote('')
    setError(null)
  }

  /** The product to create, or a message saying what is missing. */
  const newProduct = (): NewProductDraft | string => {
    if (draft === null || draft.billerCode === '') return 'Choose the internal biller the new product belongs to.'
    if (draft.name.trim() === '') return 'Give the new product a name.'
    if (draft.code.trim() === '') return 'Give the new product a code.'

    if (draft.amountType === 'FIXED') {
      const fixed = parseNaira(draft.fixed)
      if (fixed === null) return 'Enter the price in naira, for example 1000 or 1,500.50.'

      return { billerCode: draft.billerCode, code: draft.code.trim(), name: draft.name.trim(), amountType: 'FIXED', fixedAmountMinor: fixed }
    }

    const minimum = draft.minimum.trim() === '' ? undefined : parseNaira(draft.minimum)
    const maximum = draft.maximum.trim() === '' ? undefined : parseNaira(draft.maximum)
    if (minimum === null || maximum === null) return 'Enter the minimum and maximum in naira, or leave them empty.'

    return {
      billerCode: draft.billerCode,
      code: draft.code.trim(),
      name: draft.name.trim(),
      amountType: 'VARIABLE',
      minimumAmountMinor: minimum,
      maximumAmountMinor: maximum,
    }
  }

  const decide = async (decision: 'approve' | 'reject') => {
    if (reviewing === null) return

    setError(null)
    setFieldErrors({})

    const creating = decision === 'approve' && reviewing.changeType === 'NEW' && mode === 'new'
    const created = creating ? newProduct() : null

    if (typeof created === 'string') {
      setError(created)

      return
    }

    if (decision === 'approve' && !creating && reviewing.requiresProductChoice && productCode === '') {
      setError('Choose the internal product this provider product maps to, or create one.')

      return
    }

    if (decision === 'reject' && note.trim() === '') {
      setError('A rejection needs a reason — it is what someone reads when the item comes back next sync.')

      return
    }

    try {
      await confirmed(() =>
        api.post(`/admin/catalog/sync-items/${reviewing.id}/${decision}`, {
          productCode: decision === 'approve' && !creating && productCode !== '' ? productCode : undefined,
          newProduct: created ?? undefined,
          note: note.trim() === '' ? undefined : note.trim(),
        }),
      )
      setReviewing(null)
      setProductCode('')
      setDraft(null)
      setNote('')
      refresh()
    } catch (caught) {
      const fields = caught instanceof ApiError ? caught.fieldErrors() : {}

      if (Object.keys(fields).length > 0) {
        setFieldErrors(fields)
      } else {
        setError(caught instanceof ApiError ? caught.message : 'The decision could not be recorded.')
      }
    }
  }

  if (runs.isPending || items.isPending) return <Loading label="Loading catalog sync" />
  if (runs.isError || items.isError) return <Notice>Could not load catalog synchronisation.</Notice>

  const pending = items.data
  const providers = [...new Set(runs.data.map((r) => r.providerCode))]

  const billers = (tree.data ?? []).flatMap((category) =>
    (category.billers ?? []).map((biller) => ({ ...biller, categoryName: category.name })),
  )

  const updateDraft = (change: Partial<NewProductForm>) =>
    setDraft((current) => {
      if (current === null) return current

      const next = { ...current, ...change }

      // The code follows the biller and name until somebody types one.
      if (!next.codeEdited && next.billerCode !== '') next.code = codeFor(next.billerCode, next.name)

      return next
    })

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
                        <div>
                          {item.providerProductName ?? '—'}
                          {price(item) && <span className="mono"> · {price(item)}</span>}
                        </div>
                        <div className="panel__subtitle">
                          <span className="mono">{item.providerProductCode}</span>
                          {' · '}
                          {item.providerPayload.billerName ?? item.providerBillerCode}
                          {item.providerPayload.billerName && item.providerBillerCode && ` (${item.providerBillerCode})`}
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
                          <Button variant="secondary" onClick={() => open(item)}>
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
                        {run.skippedBillers.length > 0 && (
                          // Refused by the provider this time, so neither
                          // compared nor proposed for removal.
                          <details>
                            <summary className="panel__subtitle" style={{ cursor: 'pointer', fontSize: 12 }}>
                              {run.skippedBillers.length} skipped — the provider would not list{' '}
                              {run.skippedBillers.length === 1 ? 'it' : 'them'}
                            </summary>
                            <ul className="panel__subtitle">
                              {run.skippedBillers.map((skipped) => (
                                <li key={`${skipped.categoryCode}:${skipped.billerCode ?? ''}`}>
                                  <span className="mono">{skipped.billerCode ?? skipped.categoryCode}</span>
                                  {skipped.billerName && ` ${skipped.billerName}`} — {skipped.message}
                                </li>
                              ))}
                            </ul>
                          </details>
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
            {price(reviewing) && (
              <Detail label="Price">
                <span className="mono">{price(reviewing)}</span>
              </Detail>
            )}
            <Detail label="Provider biller">
              {reviewing.providerPayload.billerName ?? '—'}{' '}
              <span className="mono">{reviewing.providerBillerCode}</span>
            </Detail>
            <Detail label="Provider category">
              {reviewing.providerPayload.categoryName ?? '—'}{' '}
              <span className="mono">{reviewing.providerCategoryCode}</span>
            </Detail>
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
              <Select label="Maps to" value={mode} onChange={(value) => setMode(value as 'existing' | 'new')}>
                <option value="existing">An existing internal product</option>
                <option value="new">A new internal product, created now</option>
              </Select>

              {mode === 'existing' ? (
                <>
                  <Select label="Internal product" value={productCode} onChange={setProductCode}>
                    <option value="">Choose a product…</option>
                    {billers
                      .filter((biller) => biller.products.length > 0)
                      .map((biller) => (
                        <optgroup key={biller.code} label={`${biller.categoryName} · ${biller.name}`}>
                          {biller.products.map((product) => (
                            <option key={product.code} value={product.code}>
                              {product.name} ({product.code})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                  </Select>
                  <p className="panel__subtitle">
                    Which platform product this provider product fulfils. It is what keeps the provider's own code out of
                    every client response.
                  </p>
                </>
              ) : (
                draft && (
                  <>
                    <Select label="Internal biller" value={draft.billerCode} onChange={(billerCode) => updateDraft({ billerCode })}>
                      <option value="">Choose a biller…</option>
                      {(tree.data ?? []).map((category) => (
                        <optgroup key={category.code} label={category.name}>
                          {category.billers.map((biller) => (
                            <option key={biller.code} value={biller.code}>
                              {biller.name} ({biller.code})
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </Select>
                    {fieldErrors['newProduct.billerCode'] && <FieldError>{fieldErrors['newProduct.billerCode']}</FieldError>}
                    <Field
                      label="Name"
                      hint="What clients and customers see. The provider's name is a starting point."
                      value={draft.name}
                      error={fieldErrors['newProduct.name']}
                      onChange={(event) => updateDraft({ name: event.target.value })}
                    />
                    <Field
                      label="Code"
                      hint="The platform's own, stable code. Capital letters, digits and underscores."
                      className="mono"
                      value={draft.code}
                      error={fieldErrors['newProduct.code']}
                      onChange={(event) => updateDraft({ code: event.target.value.toUpperCase(), codeEdited: true })}
                    />
                    <Select
                      label="Price"
                      value={draft.amountType}
                      onChange={(value) => updateDraft({ amountType: value as 'FIXED' | 'VARIABLE' })}
                    >
                      <option value="FIXED">Fixed price — a plan or bouquet</option>
                      <option value="VARIABLE">Customer chooses the amount</option>
                    </Select>
                    {draft.amountType === 'FIXED' ? (
                      <Field
                        label="Price (₦)"
                        inputMode="decimal"
                        value={draft.fixed}
                        error={fieldErrors['newProduct.fixedAmountMinor']}
                        onChange={(event) => updateDraft({ fixed: event.target.value })}
                      />
                    ) : (
                      <div className="grid-2">
                        <Field
                          label="Minimum (₦)"
                          inputMode="decimal"
                          value={draft.minimum}
                          error={fieldErrors['newProduct.minimumAmountMinor']}
                          onChange={(event) => updateDraft({ minimum: event.target.value })}
                        />
                        <Field
                          label="Maximum (₦)"
                          inputMode="decimal"
                          value={draft.maximum}
                          error={fieldErrors['newProduct.maximumAmountMinor']}
                          onChange={(event) => updateDraft({ maximum: event.target.value })}
                        />
                      </div>
                    )}
                  </>
                )
              )}
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

/** For a control with no `error` prop of its own, such as `Select`. */
function FieldError({ children }: { children: string }) {
  return (
    <div style={{ marginTop: 'var(--space-1)', fontSize: '12px', color: 'var(--color-accent-700)' }}>{children}</div>
  )
}
