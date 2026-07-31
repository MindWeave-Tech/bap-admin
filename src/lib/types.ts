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
  /** What the current status means, in a sentence. */
  statusMeaning?: string
  /** How to get from here to serving traffic, when that is not obvious. */
  routeToService?: string | null
  breaker: BreakerDetail
  health: ProviderHealthDetail
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

export interface CatalogSyncRun {
  id: number
  providerCode: string
  environment: string
  status: string
  counts: { new: number; changed: number; removed: number; unchanged: number }
  errorMessage: string | null
  startedAt: string
  completedAt: string | null
  /** How many items still need a decision — the reason to open the queue. */
  pendingItems: number
}

export interface CatalogSyncItem {
  id: number
  runId: number
  providerCode: string | null
  environment: string | null
  changeType: string
  providerCategoryCode: string | null
  providerBillerCode: string | null
  providerProductCode: string
  providerProductName: string | null
  differences: Record<string, { from?: unknown; to?: unknown }>
  providerPayload: Record<string, unknown>
  suggestedProduct: { code: string; name: string } | null
  /** True when approval cannot proceed until an internal product is chosen. */
  requiresProductChoice: boolean
  currentMapping: { id: number; version: number } | null
  reviewStatus: string
  reviewedBy: string | null
  reviewedAt: string | null
  reviewNote: string | null
}

export interface CallbackRow {
  id: number
  eventId: string
  eventType: string
  status: string
  attempts: number
  lastResponseStatus: number | null
  lastError: string | null
  callbackUrl: string
  apiClient: { id: number; name: string | null; code: string | null }
  transactionReference: string | null
  nextAttemptAt: string | null
  deliveredAt: string | null
  createdAt: string | null
}

export interface TransactionAging {
  bucketMinutes: number[]
  /** Keyed by bucket edge in minutes, plus 'older'. */
  counts: Record<string, number>
  total: number
  /** Past the last edge automated requery has given up; these need a person. */
  beyondBoundary: number
}

export interface BalanceSnapshot {
  id: number
  providerCode: string
  currency: string
  availableMinor: number
  source: string
  takenAt: string
  recordedBy: string | null
  approvedAt: string | null
  /** A manual entry is a proposal until somebody else countersigns it. */
  awaitingApproval: boolean
  rejectedReason: string | null
  note: string | null
}

export interface BalanceRegisterRow {
  providerCode: string
  environment: string
  balance: BalanceSnapshot | null
  /** Too old to act on — reported as unknown rather than as a low balance. */
  stale: boolean
  alertLevel: string | null
  estimatedVends: number | null
  thresholds: { warningMinor: number | null; criticalMinor: number | null }
}

export interface BalanceRegister {
  register: BalanceRegisterRow[]
  awaitingApproval: BalanceSnapshot[]
}

export interface ProviderHealthDetail {
  state: string
  /** What the metrics say, shown even when an override is in force. */
  derivedState: string | null
  reason: string | null
  metrics: {
    sampleSize: number
    failureRatePercent: number
    timeoutRatePercent: number
    pendingRatePercent: number
    medianLatencyMs: number | null
  } | null
  evaluatedAt: string | null
  override: { state: string; reason: string; expiresAt: string; setBy: string | null } | null
}

export interface ReconciliationImportRow {
  id: number
  source: string
  filename: string | null
  digest: string
  rowCount: number
  acceptedCount: number
  rejectedCount: number
  /** A superseded import is what the provider said before they changed their story. */
  supersededAt: string | null
  live: boolean
  importedBy: string | null
  importedAt: string
  rejections: { rowNumber: number; reason: string; raw: string | null }[]
}

export interface ReconciliationBatchRow {
  id: number
  providerCode: string
  environment: string
  windowStartsAt: string
  windowEndsAt: string
  status: string
  internalCount: number
  externalCount: number
  matchedCount: number
  varianceCount: number
  /** Null means never compared, which is not the same as compared and clean. */
  matchedAt: string | null
  openedBy: string | null
  imports?: ReconciliationImportRow[]
}

export interface VarianceRow {
  id: number
  batchId: number
  providerCode: string | null
  status: string
  /** How much the finding matters. The queue is ordered by this, not by age. */
  consequence: number
  detail: string | null
  internal: {
    reference: string | null
    transactionReference: string | null
    amountMinor: number | null
    status: string | null
    /** Only the corrections the state machine would actually accept. */
    correctableTo: string[]
  } | null
  external: {
    reference: string | null
    amountMinor: number | null
    outcome: string | null
    /** What the statement literally said, beside what it was read as. */
    providerStatusRaw: string | null
    rowNumber: number | null
  } | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionReason: string | null
}

export interface VarianceQueue {
  data: VarianceRow[]
  meta: { page: number; perPage: number; total: number; lastPage: number }
}

export interface AlertDeliveryRow {
  channel: string
  target: string | null
  status: string
  failureReason: string | null
  attemptedAt: string
}

export interface AlertRow {
  id: number
  event: string
  label: string
  severity: string
  subject: string
  summary: string
  context: Record<string, unknown> | null
  /** Repeats folded in while cooling down. Forty and one are different situations. */
  occurrences: number
  firstSeenAt: string
  lastSeenAt: string
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  /** Whether anybody was told, as distinct from whether the platform meant to. */
  deliveries: AlertDeliveryRow[]
}

export interface AlertQueue {
  data: AlertRow[]
  meta: { unacknowledged: number; critical: number }
}

export interface IncidentRow {
  id: number
  event: string
  label: string
  severity: string
  subject: string
  summary: string
  status: string
  /** Only what the state machine accepts, so no button is offered that would be refused. */
  allowedTransitions: string[]
  alertCount: number
  openedAt: string
  lastAlertAt: string
  acknowledgedAt: string | null
  acknowledgedBy: string | null
  resolvedAt: string | null
  resolvedBy: string | null
  resolutionReason: string | null
}

export interface IncidentDetail extends IncidentRow {
  alerts: {
    id: number
    summary: string
    occurrences: number
    context: Record<string, unknown> | null
    lastSeenAt: string
    delivered: boolean
  }[]
  transactions: { transactionReference: string; clientReference: string; status: string }[]
}

export interface IncidentQueue {
  data: IncidentRow[]
  meta: { open: number; critical: number }
}

/** E28, ADR-019. */
export interface ClientWalletRow {
  id: number
  clientId: number
  clientCode: string
  clientName: string
  clientType: string
  currency: string
  availableMinor: number
  reservedMinor: number
  ledgerMinor: number
  enforcementMode: 'ENFORCE' | 'OVERDRAFT' | 'RECORD_ONLY'
  overdraftLimitMinor: number
  isOverdrawn: boolean
  balanceReconciledAt: string | null
}
