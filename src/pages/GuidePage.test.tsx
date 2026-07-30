import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { GuidePage } from './GuidePage'
import { AuthContext } from '../lib/auth-context'
import { Permission, type PermissionName } from '../lib/permissions'
import type { AdminProfile } from '../lib/types'

/**
 * The guide is permission-aware: a section about a screen somebody cannot open
 * is a list of things to go and ask for.
 *
 * This is also the console's first page-level test. Until now `tsc`, lint and the
 * build caught type and syntax errors, and nothing asserted that a page renders
 * what it claims to.
 */
function renderGuideFor(permissions: PermissionName[]) {
  const user: AdminProfile = {
    id: 1,
    name: 'Ada Operator',
    email: 'ada@example.com',
    status: 'active',
    twoFactorEnabled: true,
    roles: ['operations_analyst'],
    permissions,
  }

  return render(
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
        <GuidePage />
      </AuthContext.Provider>
    </MemoryRouter>,
  )
}

describe('GuidePage', () => {
  it('always shows the sections that need no permission', () => {
    renderGuideFor([])

    expect(screen.getByText('Every day')).toBeTruthy()
    expect(screen.getByText('Access and accounts')).toBeTruthy()
  })

  it('hides guidance for screens the operator cannot open', () => {
    renderGuideFor([])

    expect(screen.queryByText('Providers and routing')).toBeNull()
    expect(screen.queryByText('Balances and reconciliation')).toBeNull()
  })

  it('shows provider guidance to somebody who can see providers', () => {
    renderGuideFor([Permission.ProvidersView])

    expect(screen.getByText('Providers and routing')).toBeTruthy()
  })

  it('answers the question a new provider actually prompts', async () => {
    renderGuideFor([Permission.ProvidersView])

    // Sections start collapsed apart from the daily one, so this also checks
    // that opening a section reveals its answers.
    await userEvent.click(screen.getByRole('button', { name: 'Show Providers and routing' }))

    // The lifecycle gate is deliberate, and this is where somebody stuck at
    // draft finds out why and what to do about it.
    expect(screen.getByText('I created a provider and cannot set it to Active.')).toBeTruthy()
  })

  it('leads with what the platform will not do', () => {
    renderGuideFor([])

    // The two properties everything else follows from: it never guesses about
    // money, and consequential actions carry a name.
    expect(screen.getByText(/never guesses about money/)).toBeTruthy()
  })
})
