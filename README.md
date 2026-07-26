# BAP Admin — Biller Aggregation and Vending Platform

React administration dashboard for the Biller Aggregation and Vending Platform. Talks to the BAP API (`bap-api` repository); product specification and delivery plan live in the `bap-docs` repository.

## Stack

React 19 · TypeScript · Vite · React Router · TanStack Query · Vitest

No component library: a small set of accessible primitives lives in [src/components/ui](src/components/ui), styled with CSS custom properties that follow the operator's light or dark system preference.

## Local development

```bash
npm install
npm run dev
```

Requests to `/api` are proxied to `http://localhost:8000` (override with `VITE_API_TARGET`), so the browser sees one origin and no CORS configuration is needed. Start the API first — see the API repository's README.

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
