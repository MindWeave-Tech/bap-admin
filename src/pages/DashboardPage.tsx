import { useAuth } from '../lib/auth-context'
import { Screen } from '../components/layout/Screen'
import { Panel, Stat, Tag } from '../components/ui'

/**
 * Overview. The operational KPI grid from the console design (transaction
 * outcomes, pending aging, provider health, float, queue health) lands with
 * the reporting and provider-health epics, which need their admin APIs first.
 */
export function DashboardPage() {
  const { user } = useAuth()

  return (
    <Screen
      number="01"
      title={`Welcome, ${user?.name.split(' ')[0] ?? 'operator'}`}
      description="Operational dashboards arrive with the provider health, reporting and reconciliation epics. Transactions, catalog, clients and administration are live."
    >
      <div className="stack">
        <div className="grid-3">
          <Stat value={user?.permissions.length ?? 0} label="Permissions granted" />
          <Stat value={user?.roles.length ?? 0} label="Roles assigned" />
          <Stat value={user?.twoFactorEnabled ? 'On' : 'Off'} label="Two-factor" />
        </div>

        <div className="grid-2">
          <Panel title="Your access" subtitle="What this account may do in the console">
            <div className="stack-tight">
              <div className="row">
                {user?.roles.map((role) => <Tag key={role}>{role.replaceAll('_', ' ')}</Tag>) ?? null}
              </div>
              <p className="panel__subtitle">
                Sensitive actions — credential management, identifier unmasking, transaction resolution — additionally
                require a recent password confirmation.
              </p>
            </div>
          </Panel>

          <Panel title="Platform capabilities" subtitle="Deployed and covered by tests">
            <ul className="stack-tight" style={{ margin: 0, paddingLeft: 'var(--space-4)', fontSize: '13px' }}>
              <li>Vending API with idempotency, safe requery and a 24-hour manual-review boundary</li>
              <li>Payment authorization boundary with single-consumption enforcement</li>
              <li>Canonical catalog with versioned provider mappings</li>
              <li>Provider webhook inbox and signed client callbacks</li>
              <li>Administrator access control, audit trail and API client management</li>
            </ul>
          </Panel>
        </div>
      </div>
    </Screen>
  )
}
