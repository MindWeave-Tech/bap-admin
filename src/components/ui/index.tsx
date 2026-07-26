import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import './ui.css'

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  loading?: boolean
}

export function Button({ variant = 'primary', size = 'md', loading = false, children, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={[
        'btn',
        variant !== 'primary' ? `btn--${variant}` : '',
        size === 'sm' ? 'btn--sm' : '',
        props.className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {loading && <span className="spinner" aria-hidden="true" />}
      {children}
    </button>
  )
}

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  hint?: string
  error?: string
}

export function Field({ label, hint, error, ...props }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')

  return (
    <div className="field">
      <label className="field__label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={`input ${error ? 'input--invalid' : ''}`}
      />
      {hint && (
        <span className="field__hint" id={`${id}-hint`}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field__error" id={`${id}-error`}>
          {error}
        </span>
      )}
    </div>
  )
}

export function Card({
  title,
  subtitle,
  actions,
  children,
  bodyless = false,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  bodyless?: boolean
}) {
  return (
    <section className="card">
      {(title || actions) && (
        <header className="card__header">
          <div className="card__title">
            {typeof title === 'string' ? <h2>{title}</h2> : title}
            {subtitle && <span className="card__subtitle">{subtitle}</span>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      {bodyless ? children : <div className="card__body">{children}</div>}
    </section>
  )
}

type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'accent'

export function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: BadgeTone }) {
  return <span className={`badge ${tone !== 'neutral' ? `badge--${tone}` : ''}`}>{children}</span>
}

/** Maps a lifecycle status string onto a badge tone. */
export function StatusBadge({ status }: { status: string }) {
  const tone: BadgeTone = ['active', 'delivered', 'processed', 'success'].includes(status.toLowerCase())
    ? 'success'
    : ['suspended', 'locked', 'revoked', 'disabled', 'failed', 'quarantined'].includes(status.toLowerCase())
      ? 'danger'
      : ['pending', 'retrying', 'sandbox'].includes(status.toLowerCase())
        ? 'warning'
        : 'neutral'

  return <Badge tone={tone}>{status}</Badge>
}

export function Alert({
  tone = 'error',
  title,
  children,
}: {
  tone?: 'error' | 'success' | 'warning'
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={`alert alert--${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {title && <span className="alert__title">{title}</span>}
      {children}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <strong>{title}</strong>
      {children}
    </div>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="empty" role="status">
      <span className="spinner" aria-hidden="true" />
      <span className="muted">{label}…</span>
    </div>
  )
}

export function Dialog({
  title,
  onClose,
  children,
  footer,
}: {
  title: string
  onClose: () => void
  children: ReactNode
  footer?: ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const titleId = useId()

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    ref.current?.querySelector<HTMLElement>('input, select, textarea, button')?.focus()
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onClose])

  return (
    <div className="dialog-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={ref}>
        <header className="dialog__header">
          <h2 id={titleId}>{title}</h2>
        </header>
        <div className="dialog__body">{children}</div>
        {footer && <div className="dialog__footer">{footer}</div>}
      </div>
    </div>
  )
}
