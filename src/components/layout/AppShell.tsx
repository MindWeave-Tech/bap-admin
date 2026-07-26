import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../lib/auth-context'
import { Permission, type PermissionName } from '../../lib/permissions'
import { Button } from '../ui'
import './shell.css'

interface NavItem {
  to: string
  label: string
  permission?: PermissionName
  /** Screens whose epics are not built yet stay visible but inert. */
  upcoming?: boolean
}

const NAV: NavItem[] = [
  { to: '/', label: 'Dashboard' },
  { to: '/transactions', label: 'Transactions', permission: Permission.TransactionsView, upcoming: true },
  { to: '/providers', label: 'Providers', permission: Permission.ProvidersView, upcoming: true },
  { to: '/catalog', label: 'Service catalog', permission: Permission.CatalogView, upcoming: true },
  { to: '/routing', label: 'Routing', permission: Permission.RoutingView, upcoming: true },
  { to: '/reconciliation', label: 'Reconciliation', permission: Permission.ReconciliationView, upcoming: true },
  { to: '/api-clients', label: 'API clients', permission: Permission.ApiClientsView },
  { to: '/users', label: 'Users and roles', permission: Permission.UsersManage },
  { to: '/audit-logs', label: 'Audit logs', permission: Permission.AuditLogsView, upcoming: true },
]

export function AppShell() {
  const { user, can, signOut } = useAuth()
  const visible = NAV.filter((item) => !item.permission || can(item.permission))

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <span className="shell__brand-mark" aria-hidden="true">
            BAP
          </span>
          <span className="shell__brand-text">Biller Aggregation Platform</span>
        </div>

        <nav className="shell__nav" aria-label="Main">
          {visible.map((item) =>
            item.upcoming ? (
              <span key={item.to} className="shell__link shell__link--upcoming" aria-disabled="true">
                {item.label}
                <span className="shell__soon">soon</span>
              </span>
            ) : (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                className={({ isActive }) => `shell__link ${isActive ? 'shell__link--active' : ''}`}
              >
                {item.label}
              </NavLink>
            ),
          )}
        </nav>
      </aside>

      <div className="shell__main">
        <header className="shell__topbar">
          <div />
          <div className="row">
            <NavLink to="/profile" className="shell__user">
              <span className="shell__user-name">{user?.name}</span>
              <span className="shell__user-email">{user?.email}</span>
            </NavLink>
            <Button variant="secondary" size="sm" onClick={() => void signOut()}>
              Sign out
            </Button>
          </div>
        </header>

        <main className="shell__content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
