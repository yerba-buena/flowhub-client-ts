# Add CSV report download capability to flowhub-client-ts

## Context

This client (`@yerba-buena/flowhub-client`) currently wraps Flowhub's documented public API — locations, inventory, order ahead. That API does not expose the reports available in the Flowhub web dashboard (sales reports, transaction details, etc.). Those reports are only downloadable as CSVs through the web UI.

We want to add a **separate dashboard client** that downloads those CSVs by replicating what the web app does internally: log in with username/password to mint a session token, then call the same internal endpoints the dashboard uses to fetch CSVs.

This is a fundamentally different beast from the public API client — different auth (username/password instead of clientId/apiKey), different stability guarantees (reverse-engineered, no contract), different risk profile. It must be cleanly separated from the main `FlowhubClient` so the repo's identity stays "client for Flowhub's documented API" and dashboard scraping is a clearly-labeled side door.

## Architecture: subpath export

The dashboard client lives in the same package but is only accessible via a separate import path:

````ts
import { FlowhubClient } from "@yerba-buena/flowhub-client";
import { FlowhubDashboardClient } from "@yerba-buena/flowhub-client/dashboard";
````

The two clients are instantiated independently with different config types. They share internal utilities (HTTP transport, base error classes) via a non-exported `src/shared/` directory.

### Target file structure

````
src/
  index.ts                    # exports FlowhubClient (public API only)
  client.ts
  resources/
    locations.ts
    inventory.ts
    order-ahead.ts
  dashboard/
    index.ts                  # exports FlowhubDashboardClient
    client.ts                 # FlowhubDashboardClient class
    session-auth.ts           # username/password → token lifecycle
    reports.ts                # report download methods
    README.md                 # dashboard-specific docs + security posture
  shared/                     # internal, NOT exported
    http.ts                   # fetch wrapper used by both
    errors.ts                 # FlowhubAuthError etc.
    types.ts
tests/
  ...
  dashboard/
    session-auth.test.ts
    reports.test.ts
docs/
  reports-discovery.md        # produced in phase 1
````

If the existing code doesn't already cleanly separate shared utilities, do that refactor as part of this PR — move the HTTP wrapper and error classes to `src/shared/` and update the existing resources to import from there. Both `src/index.ts` and `src/dashboard/index.ts` re-export the relevant error classes for users.

## Phase 1: Discovery (do this before writing any code)

We don't know Flowhub's internal auth endpoint or report endpoint shapes yet. Before implementing, produce a **discovery checklist** as a markdown file at `docs/reports-discovery.md` that I can run through manually in Chrome DevTools. It should ask me to capture:

1. The login request fired when submitting the dashboard login form: full URL, method, request body shape, response body shape (especially the token field name and any `expiresIn` / `exp` / `expiry` field).
2. The exact request fired when downloading each report type from the dashboard reports page. For each report I care about (sales summary, transactions, inventory snapshot, cash management — list these and ask me to confirm/expand), capture: URL, method, query params, headers (especially auth header format — `Authorization: Bearer ...` vs cookie vs custom header), response content-type.
3. Whether the token is sent as a bearer token, cookie, or custom header.
4. Token lifetime — ask me to log in, note the time, and check when a request first returns 401.
5. Whether any per-location scoping appears in the report URLs.
6. Whether the login response sets any cookies that subsequent requests depend on (some apps use a JWT in the body AND a session cookie).

Stop after writing the discovery doc. Wait for me to fill in the answers before continuing to phase 2.

## Phase 2: Implementation (after I provide discovery answers)

### Package config

Update `package.json` with a subpath export:

````json
{
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./dashboard": {
      "import": "./dist/dashboard/index.js",
      "types": "./dist/dashboard/index.d.ts"
    }
  }
}
````

Update `tsup.config.ts` to build both entry points (`src/index.ts` and `src/dashboard/index.ts`) with declaration files for each.

### Auth module: `src/dashboard/session-auth.ts`

A `SessionAuth` class that:
- Takes `username`, `password`, and optional `baseUrl` in its constructor
- Has a `getToken()` method that returns a valid token, logging in lazily on first call and refreshing when within 5 minutes of expiry
- Has an `invalidate()` method that clears the cached token
- Is concurrency-safe — if multiple `getToken()` calls happen simultaneously while no token is cached, only one login request fires (use a shared in-flight promise pattern, not a mutex library — this is async TS, the event loop gives us this for free)
- Surfaces `FlowhubAuthError` on failed login (reuse the existing error class from `src/shared/errors.ts`)
- Never logs the password or token, even at debug level

### Reports module: `src/dashboard/reports.ts`

A `ReportsResource` class following the same shape as the existing resource classes in `src/resources/` (look at `inventory.ts` and `locations.ts` first to match conventions). It should expose typed methods for each report type discovered in phase 1 — at minimum:

- `downloadSalesReport({ startDate, endDate, locationId? }): Promise<{ data: Buffer, filename: string }>`
- `downloadTransactionsReport({ startDate, endDate, locationId? })`
- `downloadInventorySnapshot({ locationId? })`
- (Add more based on what we find in discovery)

Each method should:
- Use a `SessionAuth` instance for the auth token
- Make the request with the correct content-type expectation (`text/csv`)
- Retry **exactly once** on a 401 by calling `auth.invalidate()` and re-requesting (do not loop — if the second attempt also 401s, throw `FlowhubAuthError`)
- Return both the raw CSV bytes and the filename suggested by the `Content-Disposition` header (fall back to a sensible default like `sales-{startDate}-{endDate}.csv` if the header is missing)
- Use the shared HTTP wrapper from `src/shared/http.ts`
- Return `Buffer` for the bytes — let the user decode if they want a string

### Dashboard client: `src/dashboard/client.ts`

A `FlowhubDashboardClient` class with this shape:

````ts
export interface FlowhubDashboardClientConfig {
  username: string;
  password: string;
  locationId?: string;  // default location for scoped methods
  baseUrl?: string;     // default to dashboard URL discovered in phase 1
  timeout?: number;     // default 30_000
}

export class FlowhubDashboardClient {
  readonly reports: ReportsResource;

  constructor(config: FlowhubDashboardClientConfig) { ... }

  forLocation(locationId: string): FlowhubDashboardClient { ... }
}
````

Validate config in the constructor — throw a clear error if `username` or `password` is missing or empty (don't wait for the first request to fail). Never include credentials in error messages.

`forLocation()` returns a new instance scoped to that location, mirroring the pattern in the main client. When the dashboard client has a `locationId` set, report methods use it as the default if the caller doesn't pass one explicitly.

### Entry point: `src/dashboard/index.ts`

Export `FlowhubDashboardClient`, `FlowhubDashboardClientConfig`, and re-export the relevant error classes (`FlowhubAuthError`, `FlowhubRateLimitError`, etc.) from shared.

Do **not** export `SessionAuth` or `ReportsResource` — those are implementation details. Users only ever interact with `FlowhubDashboardClient`.

### Tests: `tests/dashboard/`

Using vitest and whatever HTTP mocking the existing tests use (check `tests/` for the pattern):

**`session-auth.test.ts`:**
- Login happy path: returns token from response
- Concurrent `getToken()` calls only fire one login request (mock the login endpoint, call `getToken()` 5 times in parallel, assert mock was called once)
- Token reuse: two sequential `getToken()` calls return the same token, login only fires once
- Token refresh: mock `Date.now()` past the cached expiry, next `getToken()` triggers a fresh login
- 5-minute safety margin: token within the margin window triggers refresh
- `invalidate()` clears the cache, next `getToken()` re-logs in
- Failed login throws `FlowhubAuthError` with no credentials in the message

**`reports.test.ts`:**
- Happy path: `downloadSalesReport` returns Buffer + filename
- Filename extraction from `Content-Disposition` header
- Filename fallback when header is missing
- 401 retry: first request 401s, login is re-triggered, second request succeeds
- 401 retry budget: second 401 throws `FlowhubAuthError`, no third attempt
- Concurrent downloads share one token (login fires once for two parallel downloads on a fresh client)
- Location scoping: `forLocation('x').reports.downloadSalesReport(...)` uses location `x` in the request

### Documentation

Update the main `README.md` minimally:
- Do NOT add a "Reports" section in the main features list
- At the very bottom, add a single line: "For CSV report downloads from the Flowhub dashboard (reverse-engineered, not part of the public API), see [`src/dashboard/README.md`](src/dashboard/README.md)."

Update `DISCLAIMER.md` to note that the dashboard module specifically uses reverse-engineered endpoints with no stability contract.

Add a changeset in `.changeset/` describing the change as a minor version bump.

### Dashboard README: `src/dashboard/README.md`

This is its own document with a strong security posture. Use this content as the basis (adapt to discovery findings):

````markdown
# Flowhub Dashboard Client

> ⚠️ **This module uses Flowhub's internal dashboard endpoints, which are not part of their public API.**
>
> These endpoints are undocumented, not under any stability contract, and can change or break without warning. They authenticate using human dashboard credentials (username + password) rather than API keys. We use this in production at Yerba Buena and patch when it breaks, but you should expect periodic breakage and have a fallback plan.
>
> If Flowhub publishes an official reports API, switch to it immediately.

## What this is for

Downloading CSV reports (sales, transactions, inventory snapshots, etc.) that are only available through the Flowhub dashboard UI. The public Flowhub API does not expose these reports.

## Security: handling credentials

This client requires a Flowhub dashboard username and password. **These are human user credentials with full dashboard access** — treat them with the same care as a password to your bank.

### Required practices

**1. Never commit credentials to source control.** Not in `.env` files, not in config files, not in code. Add `.env` to `.gitignore` (it should already be there) and double-check before every commit.

**2. Always load credentials from environment variables or a secrets manager.** Never hardcode them, even temporarily for testing.

```ts
import { FlowhubDashboardClient } from "@yerba-buena/flowhub-client/dashboard";

const dashboard = new FlowhubDashboardClient({
  username: process.env.FLOWHUB_DASHBOARD_USERNAME!,
  password: process.env.FLOWHUB_DASHBOARD_PASSWORD!,
  locationId: process.env.FLOWHUB_LOCATION_ID,
});
```

**3. Use a dedicated service account, not a personal user.** Create a separate Flowhub user account specifically for automated report downloads. Give it the minimum permissions required (read access to reports only — no inventory edits, no transaction voids, nothing else). This way:
- Your personal credentials aren't in any deployment environment
- You can rotate the service account password independently
- You can audit what the service account did separately from human activity
- If a developer leaves, you don't have to rotate human passwords

**4. Use a secrets manager in production.** For deployed environments, pull credentials from:
- AWS Secrets Manager / Parameter Store
- GCP Secret Manager
- Azure Key Vault
- HashiCorp Vault
- Doppler, 1Password Connect, Infisical
- Platform-native secret stores (Vercel/Railway/Fly/Render env vars)

For local development, use a `.env` file (gitignored) loaded by your tooling. Do not share `.env` files via Slack, email, or DMs — use a password manager's secure sharing feature.

**5. Rotate credentials regularly.** Set a calendar reminder to rotate the service account password every 90 days, or whenever a team member with access leaves.

**6. Monitor for credential leaks.** If you ever accidentally commit credentials, rotate them immediately — don't just delete the commit. Anything pushed to a remote should be considered compromised. Tools like `git-secrets`, `gitleaks`, or GitHub's secret scanning can catch this before push.

### What this client does and doesn't do with credentials

**Does:**
- Holds them in memory for the lifetime of the client instance
- Sends them once to the discovered login endpoint over HTTPS to mint a session token
- Caches the token (not the credentials) for subsequent requests
- Re-sends credentials only when a fresh login is needed (token expired or invalidated)

**Does not:**
- Log credentials or tokens at any log level
- Persist credentials or tokens to disk
- Include credentials in error messages or stack traces
- Send credentials anywhere except the configured Flowhub login endpoint
- Cache credentials beyond the client instance's lifetime (no global state)

### Reporting a security issue

If you find a way that this client leaks credentials or tokens, please open a private security advisory on the GitHub repo rather than a public issue.

## Configuration

```ts
const dashboard = new FlowhubDashboardClient({
  username: process.env.FLOWHUB_DASHBOARD_USERNAME!,  // required
  password: process.env.FLOWHUB_DASHBOARD_PASSWORD!,  // required
  locationId: process.env.FLOWHUB_LOCATION_ID,        // optional default
  baseUrl: "https://...",                              // optional, defaults to discovered URL
  timeout: 30_000,                                     // optional, default 30s
});
```

## Usage

### Download a sales report

```ts
const { data, filename } = await dashboard.reports.downloadSalesReport({
  startDate: "2026-04-01",
  endDate: "2026-04-30",
  locationId: "your-location-id",
});

import { writeFile } from "node:fs/promises";
await writeFile(filename, data);
```

### Location scoping

If you set a default `locationId` in config, or use `forLocation()`, you can omit it from individual calls:

```ts
const cobbleHill = dashboard.forLocation("cobble-hill-location-id");

const { data } = await cobbleHill.reports.downloadSalesReport({
  startDate: "2026-04-01",
  endDate: "2026-04-30",
});
```

### Available reports

(Fill in based on discovery findings — list each method, its parameters, and what the CSV contains.)

## Token lifecycle

The client logs in lazily on first use, caches the session token in memory, and refreshes it 5 minutes before expiry. If a request returns 401 (token revoked early, server-side rotation, etc.), the client invalidates the cached token, re-logs in once, and retries the request. If the retry also 401s, it throws `FlowhubAuthError` — no infinite loops.

You don't need to manage tokens manually. The client handles it.

## Error handling

```ts
import {
  FlowhubAuthError,
  FlowhubRateLimitError,
} from "@yerba-buena/flowhub-client/dashboard";

try {
  const { data } = await dashboard.reports.downloadSalesReport({ ... });
} catch (err) {
  if (err instanceof FlowhubAuthError) {
    // Login failed — credentials may be wrong or expired, or the service account
    // may have been disabled. Check your secrets manager.
  }
  if (err instanceof FlowhubRateLimitError) {
    // Backoff and retry
  }
  throw err;
}
```

## When this will break

The internal dashboard endpoints can change without notice. Expect to need maintenance when:
- Flowhub redesigns their reports page
- Flowhub changes their auth flow (e.g., adds MFA, switches to OAuth)
- Flowhub renames query parameters or response fields
- Flowhub adds bot detection or rate limiting

Recommended operational practices:
- Run a canary download on a schedule (e.g., hourly) and alert on failure
- Pin the package version and test before upgrading
- Have a manual fallback (someone who can log into the dashboard and download reports by hand) for critical reporting deadlines

## Why this exists

Flowhub's public API doesn't currently expose the reports available in their dashboard. For operators who need automated access to sales and transaction data — for accounting, business intelligence, compliance reporting, or daily operations — there is no official path. This module provides one, with the caveat that it depends on undocumented internals.

If Flowhub ships an official reports API, this module should be deprecated in favor of it.
````

## Conventions to follow

- Match the existing code style (biome config is in `biome.json`)
- Reuse existing error classes (`FlowhubAuthError`, `FlowhubRateLimitError`, etc.) from `src/shared/errors.ts` — don't introduce new ones unless genuinely needed
- For binary CSV downloads, return `{ data: Buffer, filename: string }` — different from the `{ data, ... }` shape of public API resources because the payload is fundamentally different
- Use `node:buffer` types for the CSV bytes
- All async, no callbacks
- Strict TypeScript — no `any`
- Never log credentials or tokens, ever, at any level

## What NOT to do

- Don't use Puppeteer, Playwright, or any browser automation — this is pure HTTP
- Don't store credentials anywhere outside the client instance — they live in the config object the user passes in, full stop
- Don't add credentials to error messages, exception stack traces, or debug output
- Don't add a CLI — this is a library
- Don't try to parse the CSV into typed objects in this PR — just deliver the raw file. CSV parsing can be a separate enhancement
- Don't add reports to the main `FlowhubClient` — it stays untouched
- Don't export `SessionAuth` or `ReportsResource` from the dashboard entry point — implementation details only

## Deliverable

Open a PR with:
1. The discovery doc committed first (`docs/reports-discovery.md`)
2. After I fill it in: the implementation, including the shared/ refactor if needed
3. Tests passing
4. `src/dashboard/README.md` with the security posture content above
5. Main `README.md` updated with one bottom-of-file reference link
6. `DISCLAIMER.md` updated to note the dashboard module is reverse-engineered
7. Changeset added (minor version bump)
8. `package.json` and `tsup.config.ts` updated for the subpath export

Start with phase 1. Don't proceed to phase 2 until I've answered the discovery questions.
