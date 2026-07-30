import { useState } from 'react'
import { Link } from 'react-router'
import { api, ApiError } from '../lib/api'
import { AuthPoster } from '../components/layout/AuthPoster'
import { Button, Field, Notice } from '../components/ui'

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async () => {
    setBusy(true)
    setError(null)

    try {
      await api.post('/admin/auth/password/forgot', { email }, { anonymous: true })
      setSent(true)
    } catch (caught) {
      // Only a transport or throttle failure reaches here. The API answers the
      // same way whether or not the address is registered, and this screen must
      // not undo that by reacting differently.
      setError(caught instanceof ApiError ? caught.message : 'Could not send the reset link.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthPoster
      kicker="Recovery"
      title="Reset your password"
      body="We will email a link to the address on your operator account. The link works once and expires within the hour."
    >
      {sent ? (
        <div className="stack">
          {/*
            Deliberately says "if" — confirming that an address is registered
            would turn this page into a way to enumerate operator accounts.
          */}
          <Notice tone="neutral">
            If that address belongs to an operator, a reset link is on its way. Check the inbox, and the spam folder.
          </Notice>
          <Link to="/login">Back to sign in</Link>
        </div>
      ) : (
        <form
          className="stack"
          onSubmit={(event) => {
            event.preventDefault()
            void submit()
          }}
        >
          {error && <Notice>{error}</Notice>}

          <Field
            label="Email address"
            type="email"
            autoComplete="email"
            autoFocus
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <Button type="submit" loading={busy} className="btn-block">
            Send the link
          </Button>

          <Link to="/login">Back to sign in</Link>
        </form>
      )}
    </AuthPoster>
  )
}
