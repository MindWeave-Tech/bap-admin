import { createContext, useContext } from 'react'
import type { AdminProfile, LoginResult } from './types'
import type { PermissionName } from './permissions'

export interface AuthState {
  user: AdminProfile | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<LoginResult>
  completeTwoFactor: (challengeToken: string, code: string) => Promise<void>
  signOut: () => Promise<void>
  refresh: () => Promise<void>
  can: (permission: PermissionName) => boolean
}

export const AuthContext = createContext<AuthState | null>(null)

export function useAuth(): AuthState {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside an AuthProvider.')
  return context
}
