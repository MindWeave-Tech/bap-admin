import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../lib/auth-context'
import { ApiError } from '../lib/api'
import { AuthPoster } from '../components/layout/AuthPoster'
import { Button, Field, Notice } from '../components/ui'

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

  const credentials = stage.name === 'credentials'

  return (
    <AuthPoster
      kicker={credentials ? 'Administrator access' : 'Two-factor authentication'}
      title={credentials ? 'Sign in' : 'Verify it is you'}
      body={
        credentials
          ? 'Use your work email. Every sign-in attempt is recorded, and repeated failures lock the account.'
          : 'Enter the six-digit code from your authenticator app, or one of the recovery codes issued at enrolment.'
      }
    >
      <form
        className="stack"
        onSubmit={(event) => {
          event.preventDefault()
          void (credentials ? submitCredentials() : submitCode())
        }}
      >
        {error && <Notice>{error}</Notice>}

        {credentials ? (
          <>
            <Field
              label="Work email"
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
            <Button type="submit" loading={busy} className="btn-block">
              Sign in
            </Button>
          </>
        ) : (
          <>
            <Field
              label="Authentication code"
              inputMode="text"
              autoComplete="one-time-code"
              autoFocus
              required
              value={code}
              onChange={(event) => setCode(event.target.value)}
            />
            <Button type="submit" loading={busy} className="btn-block">
              Verify
            </Button>
            <Button variant="ghost" onClick={() => setStage({ name: 'credentials' })}>
              Start over
            </Button>
          </>
        )}
      </form>
    </AuthPoster>
  )
}
