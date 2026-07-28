import { NavLink, Outlet } from 'react-router'
import { useAuth } from '../../lib/auth-context'
import { config, isProduction } from '../../lib/config'
import { Permission, type PermissionName } from '../../lib/permissions'
import { Tag } from '../ui'
import './shell.css'

interface NavItem {
  to: string
  label: string
  permission?: PermissionName
  /** Screens whose backend epic is not built yet stay visible but inert. */
  upcoming?: boolean
}

interface NavGroup {
  label: string
  items: NavItem[]
}

const NAV: NavGroup[] = [
  {
    label: 'Operations',
    items: [
      { to: '/', label: 'Overview' },
      { to: '/transactions', label: 'Transactions', permission: Permission.TransactionsView },
      { to: '/manual-review', label: 'Manual review', permission: Permission.TransactionsView },
      { to: '/callbacks', label: 'Client callbacks', permission: Permission.TransactionsView },
      { to: '/incidents', label: 'Incidents', permission: Permission.TransactionsView, upcoming: true },
    ],
  },
  {
    label: 'Network',
    items: [
      { to: '/providers', label: 'Providers', permission: Permission.ProvidersView },
      { to: '/routing', label: 'Routing', permission: Permission.RoutingView },
      { to: '/balances', label: 'Provider balances', permission: Permission.ProviderBalancesView },
      { to: '/catalog', label: 'Service catalog', permission: Permission.CatalogView },
      { to: '/catalog/sync', label: 'Catalog sync', permission: Permission.CatalogView },
      { to: '/reconciliation', label: 'Reconciliation', permission: Permission.ReconciliationView },
    ],
  },
  {
    label: 'Administration',
    items: [
      { to: '/api-clients', label: 'API clients', permission: Permission.ApiClientsView },
      { to: '/users', label: 'Users and roles', permission: Permission.UsersManage },
      { to: '/audit-logs', label: 'Audit logs', permission: Permission.AuditLogsView },
    ],
  },
]

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

export function AppShell() {
  const { user, can, signOut } = useAuth()

  let counter = 0
  const groups = NAV.map((group) => ({
    label: group.label,
    items: group.items
      .filter((item) => !item.permission || can(item.permission))
      .map((item) => ({ ...item, number: String(++counter).padStart(2, '0') })),
  })).filter((group) => group.items.length > 0)

  return (
    <div className="shell">
      <aside className="shell__sidebar">
        <div className="shell__brand">
          <div className="shell__brand-row">
            <div className="shell__mark" aria-hidden="true">
              m
            </div>
            <div className="shell__brand-text">
              <div className="shell__brand-name">mBillsPays</div>
              <div className="shell__brand-org">MindWeave Technologies</div>
            </div>
          </div>
          <div className="shell__brand-meta">
            <span>Biller aggregation</span>
            <span className={isProduction ? 'shell__environment--live' : undefined}>{config.environment}</span>
          </div>
        </div>

        <nav className="shell__nav" aria-label="Console">
          {groups.map((group) => (
            <div key={group.label}>
              <div className="shell__group">{group.label}</div>
              {group.items.map((item) =>
                item.upcoming ? (
                  <span key={item.to} className="shell__link shell__link--upcoming" aria-disabled="true">
                    <span className="shell__num">{item.number}</span>
                    <span className="shell__label">{item.label}</span>
                    <Tag>soon</Tag>
                  </span>
                ) : (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    end={item.to === '/'}
                    className={({ isActive }) => `shell__link ${isActive ? 'shell__link--active' : ''}`}
                  >
                    <span className="shell__num">{item.number}</span>
                    <span className="shell__label">{item.label}</span>
                  </NavLink>
                ),
              )}
            </div>
          ))}
        </nav>

        <div className="shell__foot">
          <NavLink to="/profile" className="shell__profile">
            <span className="shell__avatar" aria-hidden="true">
              {initials(user?.name ?? '')}
            </span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span className="shell__profile-name">{user?.name}</span>
              <span className="shell__profile-meta">
                {user?.roles[0]?.replaceAll('_', ' ') ?? 'No role'} · {user?.twoFactorEnabled ? 'TOTP on' : 'TOTP off'}
              </span>
            </span>
          </NavLink>
          <button type="button" className="shell__signout" onClick={() => void signOut()}>
            Sign out
          </button>
        </div>
      </aside>

      <div className="shell__main">
        <Outlet />
      </div>
    </div>
  )
}
