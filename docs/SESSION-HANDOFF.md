# Session handoff / resume notes

Living status for the issue-triage + downstream-integration work. The
authoritative task state is the **GitHub issues**; this doc is the quick résumé.
Last updated: 2026-06-23.

## How this work operates
- Downstream apps (esp. `yerba-buena/sales-performance`) **vendor this client
  from GitHub `main`** and **file/track issues here**. Issues are the comms
  channel — keep them updated.
- Reverse-engineered (`internal`) features are built from **HAR captures** of
  `app.flowhub.com`. Capture → `docs/*-discovery.md` → implement. Drop captures
  in `captures/` (git-ignored). Helper: `scripts/extract-graphql-from-har.mjs`.
- Public-API facts are checked against the `yerba-buena/flowhub-api-docs` mirror
  (via GitHub code search).

## Shipped to `main`
- #3 `fetchFn` SSRF hook · #10 `employees` roster · #12 `sales` (+ verified
  `soldBy.id == employees.id`) · #13 interim `reports.downloadReportRows` + CSV
  parser · #15 rate-limit handling (throttle/jitter/headers) · date-bound
  validation + `docs/METRICS.md` (#19) · #23 + drawers GraphQL schema-drift fix.

## Open / pending
- **#13 (typed report helpers) — BLOCKED ON CREDS.** A git-ignored `.env` exists
  at repo root with empty `FLOWHUB_INTERNAL_EMAIL/PASSWORD/STORE_ID`. **Resume:**
  once filled, log in via `FlowhubInternalClient`, download `budtender-performance`
  + a loyalty/customers report into `captures/`, read columns, build typed
  helpers. (`.env` is lost on container reclaim — may need re-creating.)
- **#18** — Flowhub-side investigations (rate-limit figure, public `budtenderId`
  presence, new official endpoints, internal-use ToS, report columns, token refresh).
- **#20** — `SaleTotals` keys are camelCase at runtime but typed PascalCase
  (AOV bug). Not yet fixed — normalize in client or correct the types.
- **#22** — ergonomic/"friendly" client (e.g. `Employee.role` vs `User.role`).
- **#6/#7/#8/#9** — products / inventory / deals / inventory-log: runbooks ready,
  await HAR captures.

## Audit note (GraphQL schema drift)
The #23 fix + drawers fix came from diffing client queries against real HAR
captures. **Still unverified** (no HAR on hand): the cash-management **mutations**
+ `GetDrawerActivities` / `GetDrawerTips` use `String!` id variables that are
likely `ID!` (drawer id is `ID`) — needs a cash-management capture to confirm
(tracked on #18). Don't change blindly: `GetSales` uses `Uuid`, `GetDrawers`
uses `ID` — id scalars vary per operation.
