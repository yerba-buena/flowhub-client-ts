# Flowhub Dashboard Client

> ⚠️ **This module uses Flowhub's internal dashboard endpoints, which are not part of their public API.**
>
> These endpoints are undocumented, not under any stability contract, and can change or break without warning. They authenticate using human dashboard credentials (email + password) rather than API keys. Expect periodic breakage and have a fallback plan.
>
> If Flowhub publishes an official reports API, switch to it.

## What this is for

Downloading CSV reports (sales, transactions, inventory snapshots, etc.) that are only available through the Flowhub dashboard UI. The public Flowhub API does not expose these reports.

## How this differs from the main client

| | `FlowhubClient` (`/`) | `FlowhubDashboardClient` (`/dashboard`) |
|---|---|---|
| **Source** | Public, documented Flowhub API | Reverse-engineered internal endpoints used by app.flowhub.com |
| **Auth** | `clientId` + `apiKey` (issued by Flowhub for API access) | Dashboard user `email` + `password` |
| **Stability** | Versioned, published spec | None — can change or break without notice |
| **Returns** | JSON data | Raw CSV bytes (`Buffer`) |
| **Use this for** | Building integrations, syncing inventory/orders | Pulling reports that aren't in the public API |

Both surfaces live in the same package but are imported separately. Using the dashboard client does **not** require API access from Flowhub — but it does require valid dashboard user credentials.

## Getting credentials

You need a Flowhub dashboard user account. **Use a dedicated service account, not your personal login.**

1. Log into the Flowhub admin dashboard with an account that can manage users.
2. Create a new user (e.g. `it+reports@yourdomain.com`).
3. Assign it a role with **only** analytics/reports read access — Flowhub ships a role similar to "Analytics Only" / "Full Analytics Only" that's appropriate. Don't give it permissions to edit inventory, void transactions, manage users, etc. Least privilege.
4. Set a strong password and store it in your secrets manager.
5. Find the `store_id` you want to default to (it's a UUID — visible in dashboard URLs like `/store/<uuid>/...`, or returned in `listReports()` response context).

Why a dedicated service account:
- Personal credentials don't end up in deployment environments
- Service-account activity is auditable separately
- Rotation is independent of human users
- No re-rotation when a team member leaves

See [`.env.example`](../../.env.example) in the repo root for the env var names this module expects.

## Security: handling credentials

This client requires a Flowhub dashboard email and password. **These are human user credentials with dashboard access** — treat them carefully.

### Required practices

**1. Never commit credentials to source control.** Use `.env` (gitignored), a secrets manager, or environment variables. Verify before every commit.

**2. Use a dedicated service account, not a personal user.** Create a separate Flowhub user with the minimum role required (analytics-only is ideal). Benefits:
- Personal credentials stay out of deployment environments
- Rotate the service account password independently
- Audit service-account activity separately from human activity
- No need to rotate human passwords when a team member leaves

**3. Use a secrets manager in production.** Pull credentials from AWS Secrets Manager, GCP Secret Manager, HashiCorp Vault, Doppler, 1Password Connect, Infisical, or your platform's native env-var store.

**4. Rotate credentials regularly.** Set a 90-day rotation, or rotate when a team member with access leaves.

**5. If credentials leak, rotate immediately.** Anything pushed to a remote should be considered compromised — deleting the commit is not enough.

### What this client does and doesn't do with credentials

**Does:**
- Holds them in memory for the lifetime of the client instance
- Sends them to the GraphQL login endpoint over HTTPS to mint a session token
- Caches the token (not the credentials) for subsequent requests
- Re-sends credentials only when a fresh login is needed (token expired or invalidated)

**Does not:**
- Log credentials or tokens at any level
- Persist credentials or tokens to disk
- Include credentials in error messages or stack traces
- Send credentials anywhere except the configured Flowhub login endpoint
- Cache credentials beyond the client instance's lifetime

## Configuration

```ts
import { FlowhubDashboardClient } from "@yerba-buena/flowhub-client/dashboard";

const dashboard = new FlowhubDashboardClient({
  email: process.env.FLOWHUB_DASHBOARD_EMAIL!,        // required
  password: process.env.FLOWHUB_DASHBOARD_PASSWORD!,  // required
  storeId: process.env.FLOWHUB_STORE_ID,              // optional default
  baseUrl: "https://api.flowhub.com",                 // optional, default shown
  timeout: 30_000,                                    // optional, default 30s
});
```

## Usage

### Download a report by ID

The generic method works for any of the ~60 report IDs Flowhub exposes:

```ts
const { data, filename, contentType } = await dashboard.reports.downloadReport(
  "accounting",
  {
    start_date: "2026-04-01",
    end_date: "2026-04-30",
    store_id: "your-store-id",
  },
);

import { writeFile } from "node:fs/promises";
await writeFile(filename, data);
```

### Convenience methods

Pre-typed methods for common reports:

```ts
await dashboard.reports.downloadAccounting({ start_date, end_date, store_id });
await dashboard.reports.downloadSalesByDayStore({ start_date, end_date, store_id });
await dashboard.reports.downloadCategorySales({ start_date, end_date, store_id });
await dashboard.reports.downloadEndOfDay({ start_date, end_date, store_id });
await dashboard.reports.downloadTransactions({ start_date, end_date, store_id });
await dashboard.reports.downloadInventorySnapshot({ store_id });
await dashboard.reports.downloadInventoryLevels({ store_id });
```

### Store scoping

If you set a default `storeId` in config, or use `forStore()`, you can omit it from individual calls:

```ts
const cobbleHill = dashboard.forStore("cobble-hill-store-id");

const { data } = await cobbleHill.reports.downloadAccounting({
  start_date: "2026-04-01",
  end_date: "2026-04-30",
});
```

## Available reports

### Listing reports dynamically

Enumerate every report available to the authenticated user (including custom/shared reports specific to your account) at runtime:

```ts
const reports = await dashboard.reports.listReports();

for (const r of reports) {
  console.log(`${r.reportId} — ${r.name} (${r.type})${r.isCustom ? " [custom]" : ""}`);
  for (const p of r.parameters) {
    console.log(`  - ${p.key} (${p.type})${p.isRequired ? " *" : ""}`);
  }
}
```

`reportId` values returned here can be passed to `downloadReport(reportId, params)`.

### Known report IDs

**Finance/Accounting:** `accounting`, `end-of-day`, `tax-activity`

**Sales/Revenue:** `sales-day-store`, `category-sales`, `category-sales-daily`, `customers-sales-performance`, `employee-sales`, `product-performance`, `product-sales-performance`, `sales-customer-group`, `sales-variant`, `sold-items`, `tips-by-budtender`, `tips-by-hour`, `upsells-by-budtender`, `budtender-performance`

**Customers:** `customers`, `customers-activity`, `customers-loyalty`, `gift-cards`, `sold-gift-cards`

**Loyalty/Marketing:** `deals-full-details`, `deals-usage`, `loyalty-changes`, `loyalty-transactions`

**Staff/Operations:** `transactions`, `transaction-activities`, `transaction-adjustments`, `deliveries`, `drawers-new`, `drawers-activity`, `shifts`, `roles-activity`, `users-activity`

**Inventory:** `inventory`, `inventory-activity`, `inventory-creation`, `inventory-discrepancy-activity`, `inventory-forensics`, `inventory-levels`, `inventory-snapshot`, `par-level`, `predictive-par-level`, `product-activity`, `product-catalog`, `product-catalog-full-details`, `transfers`, `transfers-invoices`

**Compliance:** `new-york-sales`, `new-york-inventory`, `regulatory-reported-sales-failures`

## Token lifecycle

The client logs in lazily on first use, caches the session token in memory, and refreshes it 5 minutes before expiry (~4-hour token lifetime). If a request returns 401, the client invalidates the cached token, re-logs in once, and retries the request. If the retry also 401s, it throws `FlowhubAuthError` — no infinite loops.

You don't need to manage tokens manually.

## Error handling

```ts
import {
  FlowhubAuthError,
  FlowhubRateLimitError,
  FlowhubNotFoundError,
} from "@yerba-buena/flowhub-client/dashboard";

try {
  const { data } = await dashboard.reports.downloadAccounting({ /* ... */ });
} catch (err) {
  if (err instanceof FlowhubAuthError) {
    // Login failed — credentials may be wrong, expired, or the service account
    // may have been disabled.
  }
  if (err instanceof FlowhubRateLimitError) {
    // Backoff and retry
  }
  if (err instanceof FlowhubNotFoundError) {
    // Report ID doesn't exist
  }
  throw err;
}
```

## When this will break

Internal dashboard endpoints can change without notice. Expect maintenance when:
- Flowhub redesigns the reports or login pages
- Flowhub changes their auth flow (e.g., adds MFA, switches to a different provider)
- Flowhub renames query parameters or response fields
- Flowhub adds bot detection or stricter rate limiting
- **Flowhub asks you to stop.** They could block your service account, change ToS, or take other action. If that happens, deprecate use of this module.

Recommended operational practices:
- Run a canary download on a schedule and alert on failure
- Pin the package version and test before upgrading
- Have a manual fallback (someone who can log into the dashboard and download by hand) for critical deadlines
- Be a good citizen: download on a sensible schedule, not in a tight loop. The endpoints aren't rate-limited as far as we've observed, but acting like a normal dashboard user (a few requests per hour, not per second) reduces the risk of bot detection.

## Terms of service

You are using this module against Flowhub's product with credentials owned by your organization. You — not the maintainers of this client — are responsible for ensuring that automated access via your service account complies with Flowhub's terms of service. If unsure, ask Flowhub.

## Why this exists

Flowhub's public API doesn't expose the reports available in their dashboard. For operators who need automated access to sales, accounting, inventory, and compliance data — for accounting, BI, or daily operations — there is no official path. This module provides one, with the caveat that it depends on undocumented internals.

If Flowhub ships an official reports API, this module will be deprecated in favor of it.
