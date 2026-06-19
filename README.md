# @yerba-buena/flowhub-client

Unofficial TypeScript client for the [Flowhub](https://flowhub.co) API. Not affiliated with or endorsed by Flowhub, Inc.

**Related repos:**
- [flowhub-api-docs](https://github.com/yerba-buena/flowhub-api-docs) — Markdown mirror of the Flowhub developer portal
- [flowhub-api-docs-scraper](https://github.com/yerba-buena/flowhub-api-docs-scraper) — Scraper that generates the docs mirror

## Install

```bash
npm install @yerba-buena/flowhub-client
```


## Quick start

```ts
import { FlowhubClient } from "@yerba-buena/flowhub-client";

const flowhub = new FlowhubClient({
  clientId: process.env.FLOWHUB_CLIENT_ID!,
  apiKey: process.env.FLOWHUB_API_KEY!,
});

// List locations
const { data: locations } = await flowhub.locations.list();

for (const loc of locations) {
  console.log(`${loc.locationId}: ${loc.locationName}`);
}
```

## Inventory

```ts
// List all inventory
const { data: items } = await flowhub.inventory.list();

// Non-zero inventory only
const { data: inStock } = await flowhub.inventory.listNonZero();

// Inventory analytics (includes not-for-sale quantities)
const { data: analytics } = await flowhub.inventory.listAnalytics({
  includesNotForSaleQuantity: true,
});

// By room views
const { data: byRoom } = await flowhub.inventory.listByRoomsNonZero();

// Per-location endpoints
const { data: locInventory } = await flowhub.inventory.listByLocation("loc-id");
```

## Location scoping

Use `forLocation()` to get a client whose inventory methods automatically route to `/v0/locations/{locationId}/...` endpoints:

```ts
const scoped = flowhub.forLocation("your-location-id");

// These automatically use location-scoped paths
const { data } = await scoped.inventory.list();
const { data: nonZero } = await scoped.inventory.listNonZero();
```

## Order Ahead

Order Ahead endpoints require an OAuth2 access token:

```ts
const flowhub = new FlowhubClient({
  clientId: process.env.FLOWHUB_CLIENT_ID!,
  apiKey: process.env.FLOWHUB_API_KEY!,
  accessToken: process.env.FLOWHUB_ACCESS_TOKEN!,
});

// Create an order
const order = await flowhub.orderAhead.create({
  externalCreatedAt: new Date().toISOString(),
  customer: {
    firstName: "Jane",
    lastName: "Doe",
    email: "jane@example.com",
    phone: "+15551234567",
    medRecOrBoth: "rec",
  },
  orderItems: [{ productId: 42, quantityPurchased: 1 }],
  orderType: "pickup",
});

// Update an order
await flowhub.orderAhead.update("order-id", { ...updatedParams });

// Check order status
const status = await flowhub.orderAhead.getStatus("order-id");

// Trigger postback
await flowhub.orderAhead.postback("order-id");
```

## Computing sales metrics

For per-budtender **AOV / UPT / loyalty** — including which fields to read, what
to exclude, the seller-id join that matters (use the internal `sales`
`soldBy.id`, **not** the public `budtenderId`), and the order-status casing /
timezone gotchas — see **[docs/METRICS.md](./docs/METRICS.md)**.

## Error handling

All errors are typed:

```ts
import {
  FlowhubAuthError,
  FlowhubRateLimitError,
  FlowhubNotFoundError,
} from "@yerba-buena/flowhub-client";

try {
  await flowhub.locations.list();
} catch (err) {
  if (err instanceof FlowhubAuthError) {
    console.log("Invalid credentials");
  }
  if (err instanceof FlowhubRateLimitError) {
    console.log(`Retry after ${err.retryAfter}s`);
  }
}
```

## Configuration

```ts
const flowhub = new FlowhubClient({
  clientId: "your-client-id",
  apiKey: "your-api-key",
  accessToken: "your-oauth-token", // optional, needed for Order Ahead
  baseUrl: "https://api.flowhub.co", // optional
  timeout: 30_000,                   // optional, default 30s
  retries: 3,                        // optional, default 3
  fetchFn: customFetch,              // optional, defaults to globalThis.fetch
  maxDelayMs: 30_000,                // optional, cap on a single retry backoff
  jitter: "full",                    // optional, "full" (default) | "equal" | "none"
  rateLimit: { rps: 45, burst: 45 }, // optional, client-side throttle (see below)
  onRateLimit: (info) => {},         // optional, called with rate-limit header info
});
```

## Rate limiting

The public Flowhub API rejects request bursts with HTTP 429
(`FlowhubRateLimitError`). Downstream apps have observed the limit around
**~59 requests/second**, though Flowhub does not publish an exact figure or
scope (per key vs per IP, burst vs sustained), so treat it as approximate.

The client helps you stay under it in three ways:

**1. Client-side throttle (on by default).** Every request passes through a
shared token-bucket limiter, defaulting to a conservative **~45 req/s**. Tune or
disable it:

```ts
new FlowhubClient({ clientId, apiKey, rateLimit: { rps: 50, burst: 50 } });
new FlowhubClient({ clientId, apiKey, rateLimit: { rps: 0 } }); // disable
```

**2. Graceful retries.** On 429 (and 500/502/503/504) the client retries with
**full-jitter exponential backoff** (`jitter`/`maxDelayMs` configurable). If the
server sends a `Retry-After` (delta-seconds or HTTP-date), `Retry-After-Ms`, or
`X-RateLimit-Reset[-After]` / `RateLimit-*` header, that wait is honored instead.
In practice Flowhub has been observed to send **no** rate-limit headers at all
(even on 429), so throttle + jittered backoff is the effective mechanism today;
the header handling is forward-looking.

**3. Visibility.** `FlowhubRateLimitError` exposes `retryAfter` (seconds),
`limit`, `remaining`, and `resetAt` when the server provides them. Pass
`onRateLimit(info)` to observe rate-limit headers on **every** response and
self-pace. (Note: some Flowhub 429s carry no rate-limit headers at all — then
`retryAfter` is `undefined` and the client falls back to jittered backoff.)

**Reduce call volume with date bounds.** The biggest lever is fetching less.
List endpoints honor `created_after` / `created_before` server-side, so you can
pull a bounded window instead of paginating an entire location's history — a
week is ~98% fewer rows than full history:

```ts
const { orders } = await flowhub.orders.listByLocationId(importId, {
  created_after: "2026-06-01",  // YYYY-MM-DD only
  created_before: "2026-06-08",
  page_size: 100,
});
```

> - **Format:** dates must be `YYYY-MM-DD`; a full ISO timestamp is rejected by
>   Flowhub (`404 …must be in format yyyy-mm-dd`). The client validates this and
>   throws `FlowhubValidationError` before sending.
> - **Timezone:** the bound is applied in the **store's local time** (not UTC)
>   and keys on the order's **creation** date — orders near local midnight can
>   land in the adjacent UTC day, so account for the store's offset when building
>   week windows.

## Custom fetch / SSRF hardening

Both `FlowhubClient` and `FlowhubInternalClient` accept a `fetchFn` option — a
custom `fetch` implementation used for **all** outbound requests (including the
Auth0 token endpoint). It defaults to `globalThis.fetch`. This is the supported
extension point for proxies, instrumentation, test stubs, and — the motivating
use case — **SSRF-safe egress**.

> ⚠️ `fetchFn` is a *seam*, not a guarantee. The library does not validate
> destinations for you; it hands you control of the connection layer so you can
> enforce your own policy. The SSRF responsibility stays on your side.

If your application lets a (even authenticated) user influence the `baseUrl`,
validating the host's IP up front is not enough on its own: DNS can resolve to a
different, internal IP by the time the request actually connects
(**DNS rebinding**). The robust fix is to resolve once, validate the IP, and
**pin the connection to that IP**. With a custom `fetchFn` you can attach an
`undici` `Agent` whose `connect.lookup` returns only your validated address:

```ts
import { Agent, fetch as undiciFetch } from "undici";
import { lookup as dnsLookup } from "node:dns";

// Resolve + validate up front (https-only, host allowlist, reject
// private/loopback/link-local/metadata ranges), then pin to that IP.
function makePinnedFetch(validatedIp: string): typeof fetch {
  const agent = new Agent({
    connect: {
      lookup: (_hostname, _opts, cb) => cb(null, validatedIp, 4),
    },
  });
  return ((url, init) =>
    undiciFetch(url, { ...init, dispatcher: agent })) as typeof fetch;
}

const flowhub = new FlowhubClient({
  clientId: process.env.FLOWHUB_CLIENT_ID!,
  apiKey: process.env.FLOWHUB_API_KEY!,
  baseUrl: userSuppliedUrl, // already passed your https-only + IP-denylist check
  fetchFn: makePinnedFetch(validatedIp),
});
```

The same `fetchFn` option is available on `FlowhubInternalClient`. A `fetch`
wrapper is also the seam for injecting a custom `http.Agent` / `undici`
dispatcher, an egress proxy, request logging, or a mock in tests.

## Issues

If you spot a bug, incorrect API mapping, or missing endpoint, please [open an issue](https://github.com/yerba-buena/flowhub-client-ts/issues).

## Disclaimer

See [DISCLAIMER.md](./DISCLAIMER.md). This is an unofficial project maintained by Yerba Buena Brands, LLC.

## Internal (non-public) endpoints

For CSV report downloads and cash-management (drawers, drop / pay-in / pay-out events, `DrawerWatcher`) — reverse-engineered from the Flowhub web interface, not part of the public API — use the `internal` entry point:

```ts
import { FlowhubInternalClient } from "@yerba-buena/flowhub-client/internal";
```

See [`src/internal/README.md`](./src/internal/README.md) for the full usage guide, security guidance, and stability caveats, and [`docs/internal-api-reference.md`](./docs/internal-api-reference.md) for the reverse-engineered endpoint/operation reference — the unofficial counterpart to the [public API docs mirror](https://github.com/yerba-buena/flowhub-api-docs), which only covers Flowhub's documented API.

> Previously called the "dashboard client" (`@yerba-buena/flowhub-client/dashboard`). That import path and the old names still work but are deprecated — see [Breaking changes](#breaking-changes--migration) below.

## Breaking changes & migration

This section tracks renames, removals, and other source-incompatible changes to the public surface. Bug-fix and additive changes are in [CHANGELOG.md](./CHANGELOG.md). The package follows semver; while it is pre-1.0 (`0.x`), breaking changes may land in minor releases, but we still ship deprecated aliases where practical to give you a migration window.

### Unreleased — `dashboard` → `internal` rename

The reverse-engineered surface was renamed from `dashboard` to `internal`. The old name implied it only covered "the dashboard screen," but the surface is really *everything reachable outside the public API by reverse-engineering the web interface* (reports, cash management, and more to come).

**Nothing breaks yet** — the old import path and names are kept as deprecated aliases that re-export the new ones. They will be **removed in a future release**, so migrate when convenient.

| Deprecated | Replacement |
|---|---|
| `import … from "@yerba-buena/flowhub-client/dashboard"` | `import … from "@yerba-buena/flowhub-client/internal"` |
| `FlowhubDashboardClient` | `FlowhubInternalClient` |
| `FlowhubDashboardClientConfig` | `FlowhubInternalClientConfig` |
| `DEFAULT_DASHBOARD_BASE_URL` | `DEFAULT_INTERNAL_BASE_URL` |
| `FLOWHUB_DASHBOARD_*` env-var convention (examples/tests) | `FLOWHUB_INTERNAL_*` |

```ts
// before
import { FlowhubDashboardClient } from "@yerba-buena/flowhub-client/dashboard";
const client = new FlowhubDashboardClient({ email, password });

// after
import { FlowhubInternalClient } from "@yerba-buena/flowhub-client/internal";
const client = new FlowhubInternalClient({ email, password });
```

Resources (`reports`, `drawers`, `users`, `rooms`), all types, the `DrawerWatcher`, error classes, and runtime behavior are **unchanged** — only the names and import path moved.

## License

[MIT](./LICENSE)
