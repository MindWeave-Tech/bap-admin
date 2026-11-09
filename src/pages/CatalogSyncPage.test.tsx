import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { CatalogSyncPage } from './CatalogSyncPage'
import { AuthContext } from '../lib/auth-context'
import { Permission, type PermissionName } from '../lib/permissions'
import type { AdminProfile, CatalogCategoryNode, CatalogSyncItem } from '../lib/types'

const TREE: CatalogCategoryNode[] = [
  {
    code: 'AIRTIME',
    name: 'Airtime',
    country: 'NG',
    currency: 'NGN',
    status: 'active',
    billers: [
      {
        code: 'MTN',
        name: 'MTN Nigeria',
        status: 'active',
        customerIdentifierType: 'PHONE_NUMBER',
        validationRequired: false,
        products: [
          {
            code: 'MTN_AIRTIME',
            name: 'MTN Nigeria airtime',
            status: 'active',
            vendable: true,
            amountType: 'VARIABLE',
            minimum: '50.00',
            maximum: '50000.00',
            currency: 'NGN',
          },
        ],
      },
    ],
  },
  {
    code: 'DATA',
    name: 'Mobile data',
    country: 'NG',
    currency: 'NGN',
    status: 'active',
    billers: [
      {
        code: 'MTN_DATA',
        name: 'MTN Nigeria data',
        status: 'active',
        customerIdentifierType: 'PHONE_NUMBER',
        validationRequired: false,
        products: [],
      },
    ],
  },
]

function item(overrides: Partial<CatalogSyncItem>): CatalogSyncItem {
  return {
    id: 1,
    runId: 4,
    providerCode: 'FLUTTERWAVE',
    environment: 'sandbox',
    changeType: 'NEW',
    providerCategoryCode: 'MOBILEDATA',
    providerBillerCode: 'BIL104',
    providerProductCode: 'MD107',
    providerProductName: 'MTN 1.5 GB',
    differences: {},
    providerPayload: { billerName: 'MTN DATA BUNDLE', categoryName: 'Mobile Data Service', fixedAmountMinor: 100_000 },
    suggestedProduct: null,
    requiresProductChoice: true,
    suggestedBillerCode: null,
    currentMapping: null,
    reviewStatus: 'PENDING',
    reviewedBy: null,
    reviewedAt: null,
    reviewNote: null,
    ...overrides,
  }
}

function renderWith(items: CatalogSyncItem[]) {
  const posts: { url: string; body: unknown }[] = []
  const permissions: PermissionName[] = [Permission.CatalogView, Permission.CatalogPublish]

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    let body: unknown = { data: [] }

    if (init?.method === 'POST') {
      posts.push({ url, body: JSON.parse(String(init.body)) })
      body = { data: {} }
    } else if (url.includes('/catalog/sync-items')) {
      body = { data: items }
    } else if (url.includes('/catalog/tree')) {
      body = { data: TREE }
    }

    return Promise.resolve(
      new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )
  })

  const user: AdminProfile = {
    id: 1,
    name: 'Ada Operator',
    email: 'ada@example.com',
    status: 'active',
    twoFactorEnabled: true,
    roles: ['platform_administrator'],
    permissions,
  }

  render(
    <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <MemoryRouter>
        <AuthContext.Provider
          value={{
            user,
            loading: false,
            can: (permission) => permissions.includes(permission),
            signIn: async () => ({ status: 'authenticated' }) as never,
            completeTwoFactor: async () => {},
            signOut: async () => {},
            refresh: async () => {},
          }}
        >
          <CatalogSyncPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { posts }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('CatalogSyncPage review', () => {
  it('shows what the provider sells, not just its codes', async () => {
    renderWith([item({})])

    expect(await screen.findByText('MTN 1.5 GB')).toBeInTheDocument()
    expect(screen.getByText(/₦1,000/)).toBeInTheDocument()
    expect(screen.getByText(/MTN DATA BUNDLE/)).toBeInTheDocument()
  })

  it('creates the internal product for a plan that has none, prefilled from the provider', async () => {
    const { posts } = renderWith([item({ suggestedBillerCode: 'MTN_DATA' })])

    await userEvent.click(await screen.findByRole('button', { name: 'Review' }))
    const dialog = screen.getByRole('dialog')

    // A fixed-price plan defaults to creating, with the biller other MTN plans
    // already map to, and a code derived from the name.
    expect(within(dialog).getByLabelText('Code')).toHaveValue('MTN_1_5_GB')

    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))

    expect(posts).toEqual([
      {
        url: '/api/admin/catalog/sync-items/1/approve',
        body: {
          newProduct: {
            billerCode: 'MTN_DATA',
            code: 'MTN_1_5_GB',
            name: 'MTN 1.5 GB',
            amountType: 'FIXED',
            fixedAmountMinor: 100_000,
          },
        },
      },
    ])
  })

  it('asks for a biller before creating, rather than guessing one', async () => {
    const { posts } = renderWith([item({})])

    await userEvent.click(await screen.findByRole('button', { name: 'Review' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))

    expect(screen.getByText('Choose the internal biller the new product belongs to.')).toBeInTheDocument()
    expect(posts).toHaveLength(0)
  })

  it('maps an open-amount product onto the existing one', async () => {
    const { posts } = renderWith([
      item({
        providerCategoryCode: 'AIRTIME',
        providerBillerCode: 'BIL099',
        providerProductCode: 'AT099',
        providerProductName: 'MTN VTU',
        providerPayload: { billerName: 'MTN VTU', fixedAmountMinor: null },
      }),
    ])

    await userEvent.click(await screen.findByRole('button', { name: 'Review' }))
    const dialog = screen.getByRole('dialog')
    await userEvent.selectOptions(within(dialog).getByLabelText('Internal product'), 'MTN_AIRTIME')
    await userEvent.click(within(dialog).getByRole('button', { name: 'Approve' }))

    expect(posts).toEqual([{ url: '/api/admin/catalog/sync-items/1/approve', body: { productCode: 'MTN_AIRTIME' } }])
  })
})
