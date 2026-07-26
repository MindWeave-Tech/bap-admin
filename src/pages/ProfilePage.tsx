import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { SessionSummary, TwoFactorEnrolment } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Alert, Badge, Button, Card, Dialog, Field, Loading } from '../components/ui'
import { PageHeader } from '../components/layout/PageHeader'

export function ProfilePage() {
  const { user, refresh } = useAuth()
  const queryClient = useQueryClient()

  const [enrolment, setEnrolment] = useState<TwoFactorEnrolment | null>(null)
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null)
  const [disabling, setDisabling] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sessions = useQuery({
    queryKey: ['sessions'],
    queryFn: () => api.get<SessionSummary[]>('/admin/auth/sessions'),
  })

  const revoke = useMutation({
    mutationFn: (id: number) => api.delete(`/admin/auth/sessions/${id}`),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['sessions'] }),
  })

  const beginEnrolment = async () => {
    setError(null)
    try {
      setEnrolment(await api.post<TwoFactorEnrolment>('/admin/auth/two-factor/enrol'))
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not start enrolment.')
    }
  }

  return (
    <>
      <PageHeader title="Your profile" description="Account security, two-factor authentication, and active sessions." />

      <div className="stack">
        {error && <Alert>{error}</Alert>}

        <Card title="Account">
          <div className="grid-2">
            <div>
              <div className="muted">Name</div>
              <div>{user?.name}</div>
            </div>
            <div>
              <div className="muted">Email</div>
              <div>{user?.email}</div>
            </div>
            <div>
              <div className="muted">Roles</div>
              <div className="row">
                {user?.roles.map((role) => <Badge key={role}>{role}</Badge>) ?? <span className="muted">None</span>}
              </div>
            </div>
          </div>
        </Card>

        <Card
          title="Two-factor authentication"
          subtitle="Required for administrators handling provider credentials and transaction resolution."
          actions={
            user?.twoFactorEnabled ? (
              <Button variant="secondary" onClick={() => setDisabling(true)}>
                Disable
              </Button>
            ) : (
              <Button onClick={() => void beginEnrolment()}>Set up</Button>
            )
          }
        >
          {user?.twoFactorEnabled ? (
            <Alert tone="success">Two-factor authentication is enabled on this account.</Alert>
          ) : (
            <p className="muted">
              Two-factor authentication is not enabled. Set it up with any authenticator app that supports TOTP.
            </p>
          )}
        </Card>

        <Card title="Active sessions" subtitle="Revoking a session signs that device out immediately." bodyless>
          {sessions.isPending ? (
            <Loading label="Loading sessions" />
          ) : sessions.isError ? (
            <div style={{ padding: 16 }}>
              <Alert>Could not load sessions.</Alert>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Session</th>
                    <th>Last used</th>
                    <th>Expires</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {sessions.data.map((session) => (
                    <tr key={session.id}>
                      <td>
                        {session.name} {session.current && <Badge tone="accent">This device</Badge>}
                      </td>
                      <td className="muted">
                        {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : 'Not yet used'}
                      </td>
                      <td className="muted">
                        {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'No expiry'}
                      </td>
                      <td>
                        {!session.current && (
                          <Button variant="ghost" size="sm" onClick={() => revoke.mutate(session.id)}>
                            Revoke
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      {enrolment && (
        <EnrolmentDialog
          enrolment={enrolment}
          onClose={() => setEnrolment(null)}
          onConfirmed={(codes) => {
            setEnrolment(null)
            setRecoveryCodes(codes)
            void refresh()
          }}
        />
      )}

      {recoveryCodes && (
        <Dialog
          title="Save your recovery codes"
          onClose={() => setRecoveryCodes(null)}
          footer={<Button onClick={() => setRecoveryCodes(null)}>I have stored them</Button>}
        >
          <Alert tone="warning" title="Shown once">
            Each code works exactly once. Store them somewhere safe — they are your way back in if you lose your
            authenticator.
          </Alert>
          <code className="secret">{recoveryCodes.join('\n')}</code>
        </Dialog>
      )}

      {disabling && (
        <DisableTwoFactorDialog
          onClose={() => setDisabling(false)}
          onDisabled={() => {
            setDisabling(false)
            void refresh()
          }}
        />
      )}
    </>
  )
}

function EnrolmentDialog({
  enrolment,
  onClose,
  onConfirmed,
}: {
  enrolment: TwoFactorEnrolment
  onClose: () => void
  onConfirmed: (codes: string[]) => void
}) {
  const [code, setCode] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.post<{ recoveryCodes: string[] }>('/admin/auth/two-factor/confirm', { code }),
    onSuccess: (result) => onConfirmed(result.recoveryCodes),
  })

  return (
    <Dialog
      title="Set up two-factor authentication"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Confirm
          </Button>
        </>
      }
    >
      <p className="muted">
        Add this account to your authenticator app, then enter the six-digit code it shows to finish enrolment.
      </p>
      <div>
        <div className="field__label">Setup key</div>
        <code className="secret">{enrolment.secret}</code>
      </div>
      <details>
        <summary className="muted" style={{ cursor: 'pointer', fontSize: 12 }}>
          Show the full otpauth URI
        </summary>
        <code className="secret" style={{ marginTop: 6 }}>
          {enrolment.otpauthUri}
        </code>
      </details>
      {mutation.isError && (
        <Alert>{mutation.error instanceof ApiError ? mutation.error.message : 'That code was not accepted.'}</Alert>
      )}
      <Field
        label="Authentication code"
        inputMode="numeric"
        autoComplete="one-time-code"
        value={code}
        onChange={(event) => setCode(event.target.value)}
      />
    </Dialog>
  )
}

function DisableTwoFactorDialog({ onClose, onDisabled }: { onClose: () => void; onDisabled: () => void }) {
  const [password, setPassword] = useState('')

  const mutation = useMutation({
    mutationFn: () => api.delete('/admin/auth/two-factor', { password }),
    onSuccess: onDisabled,
  })

  return (
    <Dialog
      title="Disable two-factor authentication"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Disable
          </Button>
        </>
      }
    >
      <Alert tone="warning">
        Your account will be protected by password alone. Sensitive administrative actions will still require a
        password confirmation.
      </Alert>
      {mutation.isError && (
        <Alert>{mutation.error instanceof ApiError ? mutation.error.message : 'Could not disable two-factor.'}</Alert>
      )}
      <Field
        label="Confirm your password"
        type="password"
        autoComplete="current-password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
    </Dialog>
  )
}
