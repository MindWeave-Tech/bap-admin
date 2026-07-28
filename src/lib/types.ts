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

export interface Money {
  value: string
  currency: string
}

export interface TransactionSummary {
  transactionReference: string
  clientReference: string
  apiClient: { id: number; code: string | null; name: string | null }
  categoryCode: string
  billerCode: string
  productCode: string
  customerIdentifierMasked: string
  amount: Money
  status: string
  terminal: boolean
  selectedProviderCode: string | null
  failure: { category: string | null; code: string | null; message: string | null } | null
  requestedAt: string
  completedAt: string | null
}

export interface ProviderAttemptDetail {
  id: number
  providerCode: string
  environment: string
  attemptNumber: number
  providerVendReference: string
  providerTransactionReference: string | null
  providerProductCode: string | null
  mappingVersion: number | null
  status: string
  mayHaveDeliveredValue: boolean
  providerStatus: string | null
  providerMessage: string | null
  timeoutClassification: string | null
  requeryCount: number
  requestSentAt: string | null
  responseReceivedAt: string | null
}

export interface StatusHistoryEntry {
  from: string | null
  to: string
  actorType: string
  actorId: string | null
  reason: string | null
  providerStatus: string | null
  correlationId: string | null
  at: string
}

export interface WebhookEventSummary {
  id: number
  providerCode: string
  providerEventId: string | null
  eventType: string | null
  signatureVerified: boolean
  processingStatus: string
  processingAttempts: number
  receivedAt: string
  processedAt: string | null
}

export interface CallbackAttemptSummary {
  id: number
  eventId: string
  eventType: string
  status: string
  attempts: number
  lastResponseStatus: number | null
  lastError: string | null
  nextAttemptAt: string | null
  deliveredAt: string | null
}

export interface RoutingCandidate {
  providerCode: string
  eligible: boolean
  reason: string | null
  priority: number | null
  mappingVersion: number | null
  providerProductCode: string | null
}

export interface RoutingDecisionDetail {
  attemptNumber: number
  policy: string
  selectedProviderCode: string | null
  selectedMappingVersion: number | null
  eligibleCount: number
  excludedCount: number
  candidates: RoutingCandidate[]
  decidedAt: string
}

export interface TransactionDetail extends TransactionSummary {
  /** One decision per provider attempt, in attempt order. */
  routingDecisions: RoutingDecisionDetail[]
  customerIdentifier: string
  customerIdentifierUnmasked: boolean
  accountType: string | null
  phoneNumber: string | null
  network: string | null
  validationReference: string | null
  reconciliationStatus: string
  metadata: Record<string, unknown> | null
  fulfilment: Record<string, string> | null
  paymentAuthorization: {
    reference: string
    sourceSystem: string
    status: string
    verifiedVia: string
    verifiedAt: string
    consumedAt: string | null
    releasedAt: string | null
  } | null
  attempts: ProviderAttemptDetail[]
  statusHistory: StatusHistoryEntry[]
  webhookEvents: WebhookEventSummary[]
  callbacks: CallbackAttemptSummary[]
}

export interface Paginated<T> {
  data: T[]
  meta: { total: number; perPage: number; currentPage: number; lastPage: number }
}

export interface AuditLogEntry {
  id: number
  action: string
  actorType: string
  actorLabel: string | null
  resourceType: string | null
  resourceId: string | null
  beforeState: Record<string, unknown> | null
  afterState: Record<string, unknown> | null
  reason: string | null
  ipAddress: string | null
  correlationId: string | null
  at: string
}

export interface CatalogProductNode {
  code: string
  name: string
  status: string
  vendable: boolean
  amountType: string
  minimum: string | null
  maximum: string | null
  currency: string
}

export interface CatalogBillerNode {
  code: string
  name: string
  status: string
  customerIdentifierType: string | null
  validationRequired: boolean
  products: CatalogProductNode[]
}

export interface CatalogCategoryNode {
  code: string
  name: string
  country: string
  currency: string
  status: string
  billers: CatalogBillerNode[]
}

export interface ProviderMappingRow {
  id: number
  productCode: string
  billerCode: string
  providerCode: string
  environment: string
  providerBillerCode: string
  providerProductCode: string
  minimum: string | null
  maximum: string | null
  enabled: boolean
  priority: number
  version: number
  live: boolean
  effectiveFrom: string | null
  effectiveTo: string | null
  lastSynchronizedAt: string | null
}

export interface ProviderSummary {
  id: number
  code: string
  environment: string
  name: string
  description: string | null
  adapter: string
  baseUrl: string | null
  status: string
  acceptsNewTraffic: boolean
  ineligibilityReason: string | null
  priority: number
  supportedCountries: string[]
  supportedCurrencies: string[]
  connectTimeoutSeconds: number
  requestTimeoutSeconds: number
  rateLimitPerMinute: number | null
  dailyLimitMinor: number | null
  balanceWarningThresholdMinor: number | null
  maintenanceFrom: string | null
  maintenanceTo: string | null
  supportContact: string | null
  escalationContact: string | null
  activatedAt: string | null
}

export interface BreakerEvent {
  from: string
  to: string
  reason: string
  sampleSize: number
  failureRatePercent: number
  timeoutRatePercent: number
  occurredAt: string
}

export interface BreakerDetail {
  state: string
  sampleSize: number
  failureRatePercent: number
  timeoutRatePercent: number
  history: BreakerEvent[]
}

export interface ProviderDetail extends ProviderSummary {
  capabilities: { registered: boolean; declared: string[] }
  allowedTransitions: string[]
  breaker: BreakerDetail
}

export interface ProviderCredentialSummary {
  id: number
  name: string
  fingerprint: string | null
  version: number
  status: string
  activatedAt: string | null
  supersededAt: string | null
  expiresAt: string | null
  lastUsedAt: string | null
}

export interface EnablementRule {
  id: number
  scope: string
  scopeValue: string | null
  enabled: boolean
  reason: string | null
}

export interface EnablementMatrix {
  policy: string
  rules: EnablementRule[]
}

export interface EnablementEvaluation {
  enabledByRules: boolean
  reason: string
  decidingRule: { scope: string; scopeValue: string | null; enabled: boolean } | null
  providerAcceptsTraffic: boolean
  providerIneligibilityReason: string | null
  wouldServe: boolean
}

export interface RoutingPolicySummary {
  id: number
  scope: string
  scopeValue: string | null
  environment: string
  providerOrder: string[]
  version: number
  effectiveFrom: string
  /** False while a future-dated policy is still scheduled. */
  inForce: boolean
  reason: string
  author: string | null
  changeRequestId: number | null
}

export interface RoutingChangeRequestSummary {
  id: number
  scope: string
  scopeValue: string | null
  environment: string
  proposedOrder: string[]
  reason: string
  expectedImpact: string
  rollbackPlan: string
  effectiveAt: string | null
  status: string
  awaitingReview: boolean
  breakGlass: boolean
  requestedBy: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
  appliedAt: string | null
  appliedPolicyId: number | null
}

export interface RoutingSimulation {
  selectedProviderCode: string | null
  policyVersion: number | null
  /** Set when the caller supplied an order to try rather than using the live policy. */
  simulatedOrder: string[] | null
  candidates: RoutingCandidate[]
}

export interface BreakerExclusion {
  id: number
  providerCode: string
  from: string
  to: string
  reason: string
  sampleSize: number
  failureRatePercent: number
  timeoutRatePercent: number
  occurredAt: string
}

export interface OverviewAging {
  bucketMinutes: number[]
  byStatus: Record<string, Record<string, number>>
  /** Past 24 hours nothing resolves itself — these need a human today. */
  beyondManualReviewBoundary: number
}

export interface Overview {
  range: { from: string; to: string }
  outcomes: {
    total: number
    counts: Record<string, number>
    deliveredValueMinor: number
    currency: string
  }
  aging: OverviewAging
  queue: {
    queued: number
    vending: number
    /** Null when the queue could not be reached — not the same as empty. */
    depth: number | null
  }
  approvals: { routingChangeRequests: number }
  reconciliation: {
    byStatus: Record<string, number>
    varianceMinor: number | null
    /** False until reconciliation lands (E15); a zero would claim the books balance. */
    varianceAvailable: boolean
  }
}
