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
});
```

## Issues

If you spot a bug, incorrect API mapping, or missing endpoint, please [open an issue](https://github.com/yerba-buena/flowhub-client-ts/issues).

## Disclaimer

See [DISCLAIMER.md](./DISCLAIMER.md). This is an unofficial project maintained by Yerba Buena Brands, LLC.

## Internal (non-public) endpoints

For CSV report downloads and cash-management (drawers, drop / pay-in / pay-out events, `DrawerWatcher`) — reverse-engineered from the Flowhub web interface, not part of the public API — use the `internal` entry point:

```ts
import { FlowhubInternalClient } from "@yerba-buena/flowhub-client/internal";
```

See [`src/internal/README.md`](./src/internal/README.md) for the full guide, security guidance, and stability caveats.

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
