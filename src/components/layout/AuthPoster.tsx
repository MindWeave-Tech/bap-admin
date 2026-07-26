import type { ReactNode } from 'react'
import '../../pages/login.css'

/**
 * The shared frame for every unauthenticated screen: the red brand poster
 * beside a form column.
 */
export function AuthPoster({
  kicker,
  title,
  body,
  children,
}: {
  kicker: string
  title: string
  body: string
  children: ReactNode
}) {
  return (
    <div className="auth">
      <div className="auth__poster">
        <div className="auth__brand">
          <div className="auth__mark" aria-hidden="true">
            m
          </div>
          <div>
            <div className="auth__brand-name">mBillsPays</div>
            <div className="auth__brand-org">MindWeave Technologies LTD</div>
          </div>
        </div>

        <div className="auth__spacer" />

        <div className="auth__eyebrow">Biller aggregation &amp; vending platform</div>
        <div className="auth__statement">One API for every bill we vend.</div>
        <p className="auth__note">
          Administrative access is restricted, rate-limited and fully audited. Sensitive actions require a recent
          password confirmation, and there are no shared credentials.
        </p>
      </div>

      <div className="auth__form-column">
        <div className="auth__form">
          <div className="auth__kicker">{kicker}</div>
          <h1 className="auth__title">{title}</h1>
          <p className="auth__body">{body}</p>
          {children}
        </div>
      </div>
    </div>
  )
}
