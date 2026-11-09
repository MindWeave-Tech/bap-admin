import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router'
import { ClientWalletsPage } from './ClientWalletsPage'
import { AuthContext } from '../lib/auth-context'
import { Permission, type PermissionName } from '../lib/permissions'
import type {
  AdminProfile,
  ClientWalletRow,
  ClientWithoutWallet,
  PendingClientWalletFunding,
} from '../lib/types'

interface Fixture {
  wallets?: ClientWalletRow[]
  clientsWithoutWallet?: ClientWithoutWallet[]
  pending?: PendingClientWalletFunding[]
  permissions?: PermissionName[]
}

const FUNDER: PermissionName[] = [Permission.ClientWalletsView, Permission.ClientWalletsFund]
const APPROVER: PermissionName[] = [...FUNDER, Permission.ClientWalletsApprove]

/**
 * The fetch stub answers with the API's real envelopes. The page once
 * unwrapped `data` twice, which threw on render and left a blank screen.
 * Every POST is recorded so a test can assert what was actually sent.
 */
function renderWith({
  wallets = [],
  clientsWithoutWallet = [],
  pending = [],
  permissions = [Permission.ClientWalletsView],
}: Fixture = {}) {
  const posts: { url: string; body: unknown }[] = []

  vi.stubGlobal('fetch', (url: string, init?: RequestInit) => {
    let body: unknown

    if (init?.method === 'POST') {
      posts.push({ url, body: JSON.parse(String(init.body)) })
      body = { data: { id: 99, status: 'PENDING' } }
    } else if (url.includes('/client-wallet-fundings')) {
      body = { data: pending }
    } else {
      body = { data: wallets, meta: { clientsWithoutWallet } }
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
    roles: ['finance_analyst'],
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
          <ClientWalletsPage />
        </AuthContext.Provider>
      </MemoryRouter>
    </QueryClientProvider>,
  )

  return { posts }
}

const overdrawn: ClientWalletRow = {
  id: 1,
  clientId: 7,
  clientCode: 'LEDGRIA',
  clientName: 'Ledgria',
  clientType: 'INTERNAL',
  currency: 'NGN',
  availableMinor: -250_000,
  reservedMinor: 10_000,
  ledgerMinor: -240_000,
  enforcementMode: 'OVERDRAFT',
  overdraftLimitMinor: 1_000_000,
  isOverdrawn: true,
  balanceReconciledAt: '2026-07-31T09:00:00+00:00',
}

const invo: ClientWithoutWallet = { clientId: 9, clientCode: 'INVO', clientName: 'Invo', clientType: 'internal' }

function funding(id: number, requestedByUserId: number): PendingClientWalletFunding {
  return {
    id,
    clientId: 7,
    clientCode: 'LEDGRIA',
    clientName: 'Ledgria',
    amountMinor: 5_000_000,
    currency: 'NGN',
    reference: `ALLOC-${id}`,
    reason: 'Q4 allocation',
    requestedByUserId,
    requestedByName: requestedByUserId === 1 ? 'Ada Operator' : 'Bola Finance',
    requestedAt: '2026-10-15T09:00:00+00:00',
  }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('ClientWalletsPage', () => {
  it('renders the empty state when no wallet exists yet', async () => {
    renderWith()

    expect(await screen.findByText('No wallets yet')).toBeInTheDocument()
  })

  it('lists wallets and calls out the overdrawn ones', async () => {
    renderWith({ wallets: [overdrawn] })

    expect(await screen.findByText('1 client overdrawn')).toBeInTheDocument()
    expect(screen.getByText('OVERDRAFT')).toBeInTheDocument()
    expect(screen.getByText('-₦2,500')).toBeInTheDocument()
  })

  describe('requesting funding', () => {
    it('offers clients without a wallet alongside those with one', async () => {
      renderWith({ wallets: [overdrawn], clientsWithoutWallet: [invo], permissions: FUNDER })

      await userEvent.click(await screen.findByRole('button', { name: 'Request funding' }))
      const dialog = screen.getByRole('dialog')

      expect(within(dialog).getByRole('option', { name: 'LEDGRIA · Ledgria' })).toBeInTheDocument()
      expect(within(dialog).getByRole('option', { name: 'INVO · Invo' })).toBeInTheDocument()
    })

    it('checks every field before sending anything', async () => {
      const { posts } = renderWith({ clientsWithoutWallet: [invo], permissions: FUNDER })

      await userEvent.click(await screen.findByRole('button', { name: 'Request funding' }))
      const dialog = screen.getByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Amount (₦)'), '12abc')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Request funding' }))

      expect(within(dialog).getByText('Choose the client to fund.')).toBeInTheDocument()
      expect(within(dialog).getByText(/Enter an amount in naira/)).toBeInTheDocument()
      expect(within(dialog).getByText(/Give the finance reference/)).toBeInTheDocument()
      expect(posts).toHaveLength(0)
    })

    it('sends the amount in kobo, previews the balance, and confirms the request', async () => {
      const { posts } = renderWith({ wallets: [overdrawn], permissions: FUNDER })

      // The row's Fund button opens the dialog with that client already chosen.
      await userEvent.click(await screen.findByRole('button', { name: 'Fund' }))
      const dialog = screen.getByRole('dialog')
      await userEvent.type(within(dialog).getByLabelText('Amount (₦)'), '250,000.50')
      await userEvent.type(within(dialog).getByLabelText('Finance reference'), 'ALLOC-Q4')
      await userEvent.type(within(dialog).getByLabelText('Reason'), 'Q4 allocation')

      // -₦2,500 now, so ₦247,500.50 once approved.
      expect(within(dialog).getByText('₦247,500.5')).toBeInTheDocument()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Request funding' }))

      expect(posts).toEqual([
        {
          url: '/api/admin/client-wallets/7/fundings',
          body: { amountMinor: 25_000_050, reference: 'ALLOC-Q4', reason: 'Q4 allocation' },
        },
      ])
      expect(await screen.findByText('Funding requested')).toBeInTheDocument()
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    })
  })

  describe('reviewing a funding', () => {
    it('lets an approver approve a funding somebody else requested', async () => {
      const { posts } = renderWith({ wallets: [overdrawn], pending: [funding(10, 2)], permissions: APPROVER })

      await userEvent.click(await screen.findByRole('button', { name: 'Review' }))
      const dialog = screen.getByRole('dialog')
      expect(within(dialog).getByText(/^Bola Finance,/)).toBeInTheDocument()

      await userEvent.click(within(dialog).getByRole('button', { name: 'Approve ₦50,000' }))

      expect(posts).toEqual([{ url: '/api/admin/client-wallet-fundings/10/approve', body: {} }])
      expect(await screen.findByText('Funding approved')).toBeInTheDocument()
    })

    it('requires a reason before rejecting', async () => {
      const { posts } = renderWith({ wallets: [overdrawn], pending: [funding(10, 2)], permissions: APPROVER })

      await userEvent.click(await screen.findByRole('button', { name: 'Review' }))
      const dialog = screen.getByRole('dialog')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))

      expect(within(dialog).getByText('Say why this funding is rejected.')).toBeInTheDocument()
      expect(posts).toHaveLength(0)

      await userEvent.type(within(dialog).getByLabelText('Note'), 'Wrong quarter')
      await userEvent.click(within(dialog).getByRole('button', { name: 'Reject' }))

      expect(posts).toEqual([{ url: '/api/admin/client-wallet-fundings/10/reject', body: { reason: 'Wrong quarter' } }])
    })

    it('does not let the requester decide their own funding', async () => {
      renderWith({ wallets: [overdrawn], pending: [funding(11, 1)], permissions: APPROVER })

      await userEvent.click(await screen.findByRole('button', { name: 'Review' }))
      const dialog = screen.getByRole('dialog')

      expect(within(dialog).getByText('You requested this funding')).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: 'Approve ₦50,000' })).toBeDisabled()
      expect(within(dialog).getByRole('button', { name: 'Reject' })).toBeDisabled()
    })

    it('shows the queue without a review button to somebody who cannot approve', async () => {
      renderWith({ pending: [funding(10, 2)] })

      expect(await screen.findByText('ALLOC-10')).toBeInTheDocument()
      expect(screen.queryByRole('button', { name: 'Review' })).not.toBeInTheDocument()
    })
  })
})
