import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, ApiError, setUnauthenticatedHandler, tokenStore } from './api'
import { AuthContext, type AuthState } from './auth-context'
import type { AdminProfile, LoginResult } from './types'
import type { PermissionName } from './permissions'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AdminProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const loadProfile = useCallback(async () => {
    if (!tokenStore.get()) {
      setUser(null)
      setLoading(false)
      return
    }

    try {
      setUser(await api.get<AdminProfile>('/admin/auth/me'))
    } catch (error) {
      // An expired or revoked token simply means "signed out".
      if (!(error instanceof ApiError && error.isUnauthenticated)) throw error
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    setUnauthenticatedHandler(() => setUser(null))
    void loadProfile()
  }, [loadProfile])

  const signIn = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    const result = await api.post<LoginResult>('/admin/auth/login', { email, password }, { anonymous: true })

    if (result.token && result.user) {
      tokenStore.set(result.token)
      setUser(result.user)
    }

    return result
  }, [])

  const completeTwoFactor = useCallback(async (challengeToken: string, code: string) => {
    const result = await api.post<LoginResult>(
      '/admin/auth/two-factor',
      { challengeToken, code },
      { anonymous: true },
    )

    if (result.token && result.user) {
      tokenStore.set(result.token)
      setUser(result.user)
    }
  }, [])

  const signOut = useCallback(async () => {
    try {
      await api.post('/admin/auth/logout')
    } catch {
      // Signing out locally matters more than the server acknowledging it.
    } finally {
      tokenStore.clear()
      setUser(null)
    }
  }, [])

  const can = useCallback(
    (permission: PermissionName) => user?.permissions.includes(permission) ?? false,
    [user],
  )

  const value = useMemo<AuthState>(
    () => ({ user, loading, signIn, completeTwoFactor, signOut, refresh: loadProfile, can }),
    [user, loading, signIn, completeTwoFactor, signOut, loadProfile, can],
  )

  return <AuthContext value={value}>{children}</AuthContext>
}
