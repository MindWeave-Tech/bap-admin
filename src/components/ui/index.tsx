import { useEffect, useId, useRef, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from 'react'
import './ui.css'

type ButtonVariant = 'primary' | 'secondary' | 'ghost'

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  loading?: boolean
}

export function Button({ variant = 'primary', loading = false, children, className, ...props }: ButtonProps) {
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || loading}
      className={['btn', `btn-${variant}`, className].filter(Boolean).join(' ')}
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

export function Field({ label, hint, error, className, ...props }: FieldProps) {
  const id = useId()
  const describedBy = [hint ? `${id}-hint` : null, error ? `${id}-error` : null].filter(Boolean).join(' ')

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...props}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy || undefined}
        className={['input', className].filter(Boolean).join(' ')}
      />
      {hint && (
        <div className="panel__subtitle" id={`${id}-hint`} style={{ marginTop: 'var(--space-1)' }}>
          {hint}
        </div>
      )}
      {error && (
        <div id={`${id}-error`} style={{ marginTop: 'var(--space-1)', fontSize: '12px', color: 'var(--color-accent-700)' }}>
          {error}
        </div>
      )}
    </div>
  )
}

export function Select({
  label,
  value,
  onChange,
  children,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  children: ReactNode
}) {
  const id = useId()

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        {children}
      </select>
    </div>
  )
}

/** The console's primary container: a surface with a ruled header. */
export function Panel({
  title,
  subtitle,
  actions,
  children,
  flush = false,
}: {
  title?: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  flush?: boolean
}) {
  return (
    <section className="panel">
      {(title || actions) && (
        <header className="panel__header">
          <div className="panel__heading">
            {typeof title === 'string' ? <span className="panel__title">{title}</span> : title}
            {subtitle && <span className="panel__subtitle">{subtitle}</span>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </header>
      )}
      {flush ? children : <div className="panel__body">{children}</div>}
    </section>
  )
}

type TagTone = 'neutral' | 'accent' | 'outline'

export function Tag({ children, tone = 'neutral' }: { children: ReactNode; tone?: TagTone }) {
  return <span className={`tag tag-${tone}`}>{children}</span>
}

/**
 * The palette is mono by design, so status is carried by weight rather than
 * hue: live and healthy states take the accent, everything else stays neutral.
 */
export function StatusTag({ status }: { status: string }) {
  const value = status.toUpperCase()
  const accented = [
    'ACTIVE',
    'SUCCESS',
    'DELIVERED',
    'PROCESSED',
    'HEALTHY',
    'MATCHED',
    'PRODUCTION',
    'APPROVED',
  ].includes(value)

  const outlined = ['PENDING', 'PENDING_PROVIDER', 'UNKNOWN', 'MANUAL_REVIEW', 'RETRYING', 'QUEUED', 'VENDING'].includes(
    value,
  )

  return <Tag tone={accented ? 'accent' : outlined ? 'outline' : 'neutral'}>{value}</Tag>
}

export function Notice({
  tone = 'accent',
  title,
  children,
}: {
  tone?: 'accent' | 'neutral'
  title?: string
  children?: ReactNode
}) {
  return (
    <div className={`notice ${tone === 'neutral' ? 'notice--neutral' : ''}`} role={tone === 'accent' ? 'alert' : 'status'}>
      {title && <span className="notice__title">{title}</span>}
      {children}
    </div>
  )
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="state">
      <span className="state__title">{title}</span>
      {children}
    </div>
  )
}

export function Loading({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="state" role="status">
      <span className="row">
        <span className="spinner" aria-hidden="true" />
        <span>{label}…</span>
      </span>
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
        <h2 className="dialog-title" id={titleId}>
          {title}
        </h2>
        <div className="dialog-body stack-tight">{children}</div>
        {footer && <div className="dialog-actions">{footer}</div>}
      </div>
    </div>
  )
}

/** A labelled definition list, the shape every detail screen uses. */
export function Details({ children }: { children: ReactNode }) {
  return <dl className="detail">{children}</dl>
}

export function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </>
  )
}

export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="stat">
      <span className="stat__value">{value}</span>
      <span className="stat__label">{label}</span>
    </div>
  )
}
