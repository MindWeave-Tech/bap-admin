import type { ReactNode } from 'react'

/**
 * Every screen is framed the same way: a numbered sticky header carrying the
 * title and its actions, then the content column.
 */
export function Screen({
  number,
  title,
  description,
  actions,
  children,
}: {
  number: string
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
}) {
  return (
    <>
      <header className="shell__topbar">
        <div className="shell__screen-number">{number}</div>
        <div className="page-header">
          <div className="page-header__lead">
            <h1 className="page-header__title">{title}</h1>
            {description && <p className="page-header__description">{description}</p>}
          </div>
          {actions && <div className="row">{actions}</div>}
        </div>
      </header>
      <main className="shell__content">{children}</main>
    </>
  )
}
