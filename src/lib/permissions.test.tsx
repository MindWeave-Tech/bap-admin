import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router'
import { AppShell } from '../components/layout/AppShell'
import type { AdminProfile } from './types'

/**
 * Navigation is permission-aware (PRD §18): an operator only sees the
 * sections their role actually grants.
 */
function renderShellFor(permissions: string[]) {
  const user: AdminProfile = {
    id: 1,
    name: 'Ada Operator',
    email: 'ada@example.com',
    status: 'active',
    twoFactorEnabled: true,
    roles: ['operations_analyst'],
    permissions,
  }

  // A minimal stand-in for AuthProvider keeps this focused on navigation.
  return render(
    <MemoryRouter>
      <MockAuth user={user}>
        <AppShell />
      </MockAuth>
    </MemoryRouter>,
  )
}

import { AuthProvider } from './auth'
import type { ReactNode } from 'react'

function MockAuth({ user, children }: { user: AdminProfile; children: ReactNode }) {
  // AuthProvider reads the token from storage; seeding it keeps the shell
  // rendered while the profile request is stubbed out below.
  globalThis.localStorage.setItem('bap.admin.token', 'test-token')
  globalThis.fetch = (() =>
    Promise.resolve(
      new Response(JSON.stringify({ data: user }), { status: 200, headers: { 'Content-Type': 'application/json' } }),
    )) as typeof fetch

  return <AuthProvider>{children}</AuthProvider>
}

describe('permission-aware navigation', () => {
  it('hides sections the operator cannot access', async () => {
    renderShellFor(['transactions.view'])

    expect(await screen.findByText('Dashboard')).toBeInTheDocument()
    expect(screen.queryByText('Users and roles')).not.toBeInTheDocument()
    expect(screen.queryByText('API clients')).not.toBeInTheDocument()
  })

  it('shows sections the operator can access', async () => {
    renderShellFor(['users.manage', 'api_clients.view'])

    expect(await screen.findByText('Users and roles')).toBeInTheDocument()
    expect(screen.getByText('API clients')).toBeInTheDocument()
  })
})
