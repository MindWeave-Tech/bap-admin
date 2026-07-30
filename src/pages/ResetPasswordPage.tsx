import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { api, ApiError } from '../lib/api'
import { AuthPoster } from '../components/layout/AuthPoster'
import { Button, Field, Notice } from '../components/ui'

export function ResetPasswordPage() {
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
        '/admin/auth/password/reset',
        { token, password, password_confirmation: confirmation },
        { anonymous: true },
      )
      setDone(true)
      setTimeout(() => void navigate('/login', { replace: true }), 1500)
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not reset the password.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPoster
      kicker="Recovery"
      title="Choose a new password"
      body="Setting a new password signs out every other session on your account."
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          void submit()
        }}
      >
        {!token && (
          <Notice>
            This link is missing its token. Request a new one from the <Link to="/forgot-password">reset page</Link>.
          </Notice>
        )}
        {error && <Notice>{error}</Notice>}
        {done && <Notice tone="neutral">Your password has been changed. Redirecting you to sign in…</Notice>}

        <Field
          label="New password"
          type="password"
          autoComplete="new-password"
          hint="At least 12 characters."
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />

        <Field
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          required
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />

        <Button type="submit" loading={busy} disabled={!token} className="btn-block">
          Change my password
        </Button>

        <Link to="/login">Back to sign in</Link>
      </form>
    </AuthPoster>
  )
}
