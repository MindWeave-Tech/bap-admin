# BAP Admin — Biller Aggregation and Vending Platform

React administration dashboard for the Biller Aggregation and Vending Platform. Talks to the BAP API (`bap-api` repository); product specification and delivery plan live in the `bap-docs` repository.

## Stack

React 19 · TypeScript · Vite · React Router · TanStack Query · Vitest

No component library: a small set of accessible primitives lives in [src/components/ui](src/components/ui), styled with CSS custom properties that follow the operator's light or dark system preference.

## Local development

```bash
npm install
cp .env.example .env
npm run dev
```

Start the API first — see the API repository's `docs/running-locally.md`.

## Configuration

Configuration lives in `.env`; [.env.example](.env.example) is the committed template and documents each value. `.env` itself is not committed.

| Variable | Default | Purpose |
|---|---|---|
| `VITE_API_BASE_URL` | `/api` | Where the console sends API requests. Keep the default to use the dev proxy; set an absolute URL when the API is on another origin. |
| `VITE_API_PROXY_TARGET` | `http://localhost:8000` | Development only — where the dev server forwards API requests, so the browser sees one origin and no CORS setup is needed. |
| `VITE_ENVIRONMENT` | `local` | `local`, `sandbox` or `production`. Shown in the sidebar; `production` is rendered in the accent colour so an operator can never mistake it for a rehearsal. |

Only `VITE_`-prefixed variables reach the browser, and Vite inlines them into the bundle at build time — so **every value is public**. Never put a secret in `.env`. Values are read once through [src/lib/config.ts](src/lib/config.ts), which applies the defaults above; nothing else reads `import.meta.env` directly.

## What is implemented

| Area | Status |
|---|---|
| Sign-in, two-factor challenge, invitation acceptance | Built |
| Profile: 2FA enrolment, recovery codes, active sessions | Built |
| Users and roles | Built |
| API clients and credential lifecycle | Built |
| Transactions, providers, catalog, routing, reconciliation, audit logs | Land with their backend epics; navigation shows them as upcoming |

## How the API layer works

[src/lib/api.ts](src/lib/api.ts) parses the platform's standard error envelope into a typed `ApiError` carrying `code`, `category`, and field-level details. Two behaviours are worth knowing:

- A `401` clears the stored session and signs the operator out.
- A sensitive action answered with `RECENT_AUTHENTICATION_REQUIRED` is not an error to display. [useConfirmedAction](src/lib/useConfirmedAction.tsx) captures the pending action, prompts for the password, and replays it once the session is confirmed.

## Quality gates

```bash
npm run lint     # oxlint
npm test         # vitest
npm run build    # tsc type-check + production build
```

All three run in CI on every push and pull request.
