# BAP Admin — Biller Aggregation and Vending Platform

React administration dashboard for the Biller Aggregation and Vending Platform: transactions, pending/manual review, providers, catalog, routing, health, balances, reconciliation, API clients, users and roles, notifications, and audit logs.

Talks to the BAP API backend (`bap-api` repository). Product specification and delivery plan live in the `bap-docs` repository.

## Stack

React 19 · TypeScript · Vite · React Router · TanStack Query (planned)

## Local development

```bash
npm install
npm run dev
```

Expects the BAP API running at http://localhost:8000 (see the API repo's README).

## Quality gates

```bash
npm run lint     # ESLint
npm run build    # tsc type-check + production build
```

Both run in CI on every push and pull request.
