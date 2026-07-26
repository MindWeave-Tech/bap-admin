import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api, ApiError } from '../lib/api'
import { AuthPoster } from '../components/layout/AuthPoster'
import { Button, Field, Notice } from '../components/ui'

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
    <AuthPoster
      kicker="Invitation"
      title="Choose your password"
      body="Set a password to activate your administrator account. Invitations expire 72 hours after they are issued."
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {!token && <Notice>This link is missing its invitation token. Ask an administrator to reissue it.</Notice>}
        {error && <Notice>{error}</Notice>}
        {done && <Notice tone="neutral">Your account is active. Redirecting you to sign in…</Notice>}

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
        <Button type="submit" loading={busy} disabled={!token || done} className="btn-block">
          Activate account
        </Button>
        <Link to="/login" style={{ fontSize: '12px' }}>
          Back to sign in
        </Link>
      </form>
    </AuthPoster>
  )
}
