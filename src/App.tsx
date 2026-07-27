import { Navigate, Route, Routes } from 'react-router'
import { AuthProvider } from './lib/auth'
import { useAuth } from './lib/auth-context'
import { Permission, type PermissionName } from './lib/permissions'
import { AppShell } from './components/layout/AppShell'
import { EmptyState, Loading } from './components/ui'
import { LoginPage } from './pages/LoginPage'
import { AcceptInvitationPage } from './pages/AcceptInvitationPage'
import { DashboardPage } from './pages/DashboardPage'
import { UsersPage } from './pages/UsersPage'
import { ApiClientsPage } from './pages/ApiClientsPage'
import { ApiClientDetailPage } from './pages/ApiClientDetailPage'
import { ProfilePage } from './pages/ProfilePage'
import { TransactionsPage } from './pages/TransactionsPage'
import { TransactionDetailPage } from './pages/TransactionDetailPage'
import { CatalogPage } from './pages/CatalogPage'
import { ProvidersPage } from './pages/ProvidersPage'
import { RoutingPage } from './pages/RoutingPage'
import { ProviderDetailPage } from './pages/ProviderDetailPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import type { ReactNode } from 'react'

/** Waits for the session probe before deciding where to send the visitor. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()

  if (loading) return <Loading label="Checking your session" />
  if (!user) return <Navigate to="/login" replace />

  return <>{children}</>
}

function RequirePermission({ permission, children }: { permission: PermissionName; children: ReactNode }) {
  const { can } = useAuth()

  if (!can(permission)) {
    return (
      <EmptyState title="You do not have access to this page">
        Ask a platform administrator to grant the {permission} permission.
      </EmptyState>
    )
  }

  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />

        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<DashboardPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route
            path="transactions"
            element={
              <RequirePermission permission={Permission.TransactionsView}>
                <TransactionsPage />
              </RequirePermission>
            }
          />
          <Route
            path="transactions/:reference"
            element={
              <RequirePermission permission={Permission.TransactionsView}>
                <TransactionDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="manual-review"
            element={
              <RequirePermission permission={Permission.TransactionsView}>
                <TransactionsPage manualReview />
              </RequirePermission>
            }
          />
          <Route
            path="providers"
            element={
              <RequirePermission permission={Permission.ProvidersView}>
                <ProvidersPage />
              </RequirePermission>
            }
          />
          <Route
            path="providers/:id"
            element={
              <RequirePermission permission={Permission.ProvidersView}>
                <ProviderDetailPage />
              </RequirePermission>
            }
          />
          <Route
            path="routing"
            element={
              <RequirePermission permission={Permission.RoutingView}>
                <RoutingPage />
              </RequirePermission>
            }
          />
          <Route
            path="catalog"
            element={
              <RequirePermission permission={Permission.CatalogView}>
                <CatalogPage />
              </RequirePermission>
            }
          />
          <Route
            path="audit-logs"
            element={
              <RequirePermission permission={Permission.AuditLogsView}>
                <AuditLogsPage />
              </RequirePermission>
            }
          />
          <Route
            path="users"
            element={
              <RequirePermission permission={Permission.UsersManage}>
                <UsersPage />
              </RequirePermission>
            }
          />
          <Route
            path="api-clients"
            element={
              <RequirePermission permission={Permission.ApiClientsView}>
                <ApiClientsPage />
              </RequirePermission>
            }
          />
          <Route
            path="api-clients/:id"
            element={
              <RequirePermission permission={Permission.ApiClientsView}>
                <ApiClientDetailPage />
              </RequirePermission>
            }
          />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  )
}
