export interface AdminProfile {
  id: number
  name: string
  email: string
  status: string
  twoFactorEnabled: boolean
  roles: string[]
  permissions: string[]
}

export interface LoginResult {
  token?: string
  user?: AdminProfile
  requiresTwoFactor?: boolean
  challengeToken?: string
}

export interface SessionSummary {
  id: number
  name: string
  lastUsedAt: string | null
  expiresAt: string | null
  current: boolean
}

export interface AdminUser {
  id: number
  name: string
  email: string
  status: string
  twoFactorEnabled: boolean
  roles: string[]
  lastLoginAt: string | null
  invitationToken?: string
}

export interface RoleSummary {
  name: string
  label: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}

export interface PermissionSummary {
  name: string
  group: string
  isSensitive: boolean
}

export interface ApiCredentialSummary {
  id: number
  name: string
  keyId: string
  scopes: string[] | null
  status: string
  lastUsedAt: string | null
  expiresAt: string | null
}

export interface ApiClientSummary {
  id: number
  code: string
  name: string
  clientType: string
  tenant: string | null
  environment: string
  status: string
  callbackUrl: string | null
  allowedIps: string[]
  allowedCategoryCodes: string[]
  allowedBillerCodes: string[]
  allowedProductCodes: string[]
  callbackEvents: string[]
  rateLimitPerMinute: number | null
  dailyTransactionLimit: number | null
  dailyAmountLimitMinor: number | null
  expiresAt: string | null
  credentials: ApiCredentialSummary[]
}

export interface IssuedCredential {
  id: number
  name?: string
  keyId: string
  scopes?: string[] | null
  secret: string
  expiresAt?: string | null
  replacedCredentialId?: number
}

export interface TwoFactorEnrolment {
  secret: string
  otpauthUri: string
}
