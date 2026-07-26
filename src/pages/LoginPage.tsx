import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { ApiError } from '../lib/api'
import { Alert, Button, Field } from '../components/ui'
import './login.css'

type Stage = { name: 'credentials' } | { name: 'two-factor'; challengeToken: string }

export function LoginPage() {
  const { signIn, completeTwoFactor } = useAuth()
  const navigate = useNavigate()

  const [stage, setStage] = useState<Stage>({ name: 'credentials' })
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const submitCredentials = async () => {
    setBusy(true)
    setError(null)

    try {
      const result = await signIn(email, password)

      if (result.requiresTwoFactor && result.challengeToken) {
        setStage({ name: 'two-factor', challengeToken: result.challengeToken })
      } else {
        void navigate('/', { replace: true })
      }
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not sign in. Try again.')
    } finally {
      setBusy(false)
    }
  }

  const submitCode = async () => {
    if (stage.name !== 'two-factor') return

    setBusy(true)
    setError(null)

    try {
      await completeTwoFactor(stage.challengeToken, code)
      void navigate('/', { replace: true })
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not verify the code.')
      setCode('')
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
          void (stage.name === 'credentials' ? submitCredentials() : submitCode())
        }}
      >
        <div className="login__brand">
          <span className="login__mark" aria-hidden="true">
            BAP
          </span>
          <div>
            <h1>Administration</h1>
            <p className="muted">Biller Aggregation and Vending Platform</p>
          </div>
        </div>

        {error && <Alert>{error}</Alert>}

        {stage.name === 'credentials' ? (
          <>
            <Field
              label="Email"
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
            <Field
              label="Password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" loading={busy}>
              Sign in
            </Button>
          </>
        ) : (
          <>
            <Field
              label="Authentication code"
              hint="Enter the six-digit code from your authenticator app, or one of your recovery codes."
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" loading={busy}>
              Verify
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setStage({ name: 'credentials' })}>
              Start over
            </Button>
          </>
        )}
      </form>
    </div>
  )
}
