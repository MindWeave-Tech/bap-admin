import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api, ApiError } from '../lib/api'
import { Alert, Button, Field } from '../components/ui'
import './login.css'

export function AcceptInvitationPage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const token = params.get('token') ?? ''

  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)

    try {
      await api.post(
        '/admin/auth/invitations/accept',
        { token, password, password_confirmation: confirmation },
        { anonymous: true },
      )
      setDone(true)
      setTimeout(() => void navigate('/login', { replace: true }), 1500)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not accept the invitation.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="login">
      <form
        className="login__card"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        <div className="login__brand">
          <span className="login__mark" aria-hidden="true">
            BAP
          </span>
          <div>
            <h1>Accept invitation</h1>
            <p className="muted">Choose a password to activate your account</p>
          </div>
        </div>

        {!token && <Alert>This link is missing its invitation token. Ask an administrator to reissue it.</Alert>}
        {error && <Alert>{error}</Alert>}
        {done && <Alert tone="success">Your account is active. Redirecting you to sign in…</Alert>}

        <Field
          label="Password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <Field
          label="Confirm password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        <Button type="submit" loading={busy} disabled={!token || done}>
          Activate account
        </Button>
        <Link to="/login" className="muted" style={{ fontSize: 12, textAlign: 'center' }}>
          Back to sign in
        </Link>
      </form>
    </div>
  )
}
