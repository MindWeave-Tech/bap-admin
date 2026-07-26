import { useCallback, useState } from 'react'
import { api, ApiError } from './api'
import { Alert, Button, Dialog, Field } from '../components/ui'

/**
 * Runs an action that may require recent authentication (PRD §12.1).
 *
 * Sensitive endpoints answer with RECENT_AUTHENTICATION_REQUIRED when the
 * session has not confirmed a password lately. Rather than surfacing that as
 * an error, this hook captures the pending action, prompts for the password,
 * and replays the action once the session is confirmed.
 */
export function useConfirmedAction() {
  const [pending, setPending] = useState<(() => Promise<unknown>) | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const run = useCallback(async <T,>(action: () => Promise<T>): Promise<T | undefined> => {
    try {
      return await action()
    } catch (caught) {
      if (caught instanceof ApiError && caught.needsRecentAuthentication) {
        setPending(() => action)
        setError(null)
        setPassword('')
        return undefined
      }
      throw caught
    }
  }, [])

  const confirm = useCallback(async () => {
    if (!pending) return

    setBusy(true)
    setError(null)

    try {
      await api.post('/admin/auth/confirm-password', { password })
      const action = pending
      setPending(null)
      setPassword('')
      await action()
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Could not confirm your password.')
    } finally {
      setBusy(false)
    }
  }, [pending, password])

  const dialog = pending ? (
    <Dialog
      title="Confirm your password"
      onClose={() => setPending(null)}
      footer={
        <>
          <Button variant="secondary" onClick={() => setPending(null)}>
            Cancel
          </Button>
          <Button onClick={() => void confirm()} loading={busy}>
            Confirm and continue
          </Button>
        </>
      }
    >
      <p className="muted">
        This action is sensitive, so it needs a recent password confirmation before it can proceed.
      </p>
      {error && <Alert>{error}</Alert>}
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void confirm()
        }}
      >
        <Field
          label="Password"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </form>
    </Dialog>
  ) : null

  return { run, dialog }
}
