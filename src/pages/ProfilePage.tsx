import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, ApiError } from '../lib/api'
import type { SessionSummary, TwoFactorEnrolment } from '../lib/types'
import { useAuth } from '../lib/auth-context'
import { Notice, Tag, Button, Panel, Dialog, Field, Loading } from '../components/ui'
import { Screen } from '../components/layout/Screen'

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
      <Screen number="00" title="Your profile" description="Account security, two-factor authentication, and active sessions." >

      <div className="stack">
        {error && <Notice>{error}</Notice>}

        <Panel title="Account">
          <div className="grid-2">
            <div>
              <div className="panel__subtitle">Name</div>
              <div>{user?.name}</div>
            </div>
            <div>
              <div className="panel__subtitle">Email</div>
              <div>{user?.email}</div>
            </div>
            <div>
              <div className="panel__subtitle">Roles</div>
              <div className="row">
                {user?.roles.map((role) => <Tag key={role}>{role}</Tag>) ?? <span className="panel__subtitle">None</span>}
              </div>
            </div>
          </div>
        </Panel>

        <Panel
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
            <Notice tone="neutral">Two-factor authentication is enabled on this account.</Notice>
          ) : (
            <p className="panel__subtitle">
              Two-factor authentication is not enabled. Set it up with any authenticator app that supports TOTP.
            </p>
          )}
        </Panel>

        <Panel title="Active sessions" subtitle="Revoking a session signs that device out immediately." flush>
          {sessions.isPending ? (
            <Loading label="Loading sessions" />
          ) : sessions.isError ? (
            <div style={{ padding: "var(--space-4)" }}>
              <Notice>Could not load sessions.</Notice>
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
                        {session.name} {session.current && <Tag tone="accent">This device</Tag>}
                      </td>
                      <td className="panel__subtitle">
                        {session.lastUsedAt ? new Date(session.lastUsedAt).toLocaleString() : 'Not yet used'}
                      </td>
                      <td className="panel__subtitle">
                        {session.expiresAt ? new Date(session.expiresAt).toLocaleString() : 'No expiry'}
                      </td>
                      <td>
                        {!session.current && (
                          <Button variant="ghost"  onClick={() => revoke.mutate(session.id)}>
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
        </Panel>
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
          <Notice tone="accent" title="Shown once">
            Each code works exactly once. Store them somewhere safe — they are your way back in if you lose your
            authenticator.
          </Notice>
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
    </Screen>
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
      <p className="panel__subtitle">
        Add this account to your authenticator app, then enter the six-digit code it shows to finish enrolment.
      </p>
      <div>
        <div className="field__label">Setup key</div>
        <code className="secret">{enrolment.secret}</code>
      </div>
      <details>
        <summary className="panel__subtitle" style={{ cursor: 'pointer', fontSize: 12 }}>
          Show the full otpauth URI
        </summary>
        <code className="secret" style={{ marginTop: 6 }}>
          {enrolment.otpauthUri}
        </code>
      </details>
      {mutation.isError && (
        <Notice>{mutation.error instanceof ApiError ? mutation.error.message : 'That code was not accepted.'}</Notice>
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
          <Button variant="secondary" onClick={() => mutation.mutate()} loading={mutation.isPending}>
            Disable
          </Button>
        </>
      }
    >
      <Notice tone="accent">
        Your account will be protected by password alone. Sensitive administrative actions will still require a
        password confirmation.
      </Notice>
      {mutation.isError && (
        <Notice>{mutation.error instanceof ApiError ? mutation.error.message : 'Could not disable two-factor.'}</Notice>
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
