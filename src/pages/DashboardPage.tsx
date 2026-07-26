import { useAuth } from '../lib/auth-context'
import { Card } from '../components/ui'
import { PageHeader } from '../components/layout/PageHeader'

/**
 * Placeholder home. Operational KPIs (§22.1) arrive with the reporting epic,
 * which needs the admin transaction and health APIs first.
 */
export function DashboardPage() {
  const { user } = useAuth()

  return (
    <>
      <PageHeader
        title={`Welcome, ${user?.name.split(' ')[0] ?? 'operator'}`}
        description="Operational dashboards land alongside the reporting and provider-health work. For now, user, role, and API client administration are available."
      />

      <div className="grid-2">
        <Card title="Your access">
          <div className="stack">
            <div>
              <div className="muted">Roles</div>
              <div>{user?.roles.join(', ') || 'None assigned'}</div>
            </div>
            <div>
              <div className="muted">Permissions</div>
              <div>{user?.permissions.length ?? 0} granted</div>
            </div>
            <div>
              <div className="muted">Two-factor authentication</div>
              <div>{user?.twoFactorEnabled ? 'Enabled' : 'Not enabled'}</div>
            </div>
          </div>
        </Card>

        <Card title="What is live" subtitle="Platform capabilities currently deployed">
          <ul className="stack" style={{ paddingLeft: 18, margin: 0 }}>
            <li>Vending API with idempotency and safe requery</li>
            <li>Payment authorization boundary</li>
            <li>Canonical catalog and provider mappings</li>
            <li>Provider webhooks and signed client callbacks</li>
            <li>Administrator access control and API client management</li>
          </ul>
        </Card>
      </div>
    </>
  )
}
