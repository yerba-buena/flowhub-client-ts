# @yerba-buena/flowhub-client

Unofficial TypeScript client for the [Flowhub](https://flowhub.co) API. Not affiliated with or endorsed by Flowhub, Inc.

**Related repos:**
- [flowhub-api-docs](https://github.com/yerba-buena/flowhub-api-docs) — Markdown mirror of the Flowhub developer portal
- [flowhub-api-docs-scraper](https://github.com/yerba-buena/flowhub-api-docs-scraper) — Scraper that generates the docs mirror

## Install

```bash
npm install @yerba-buena/flowhub-client
```

> **Note:** This package is not yet published to npm. For now, install from GitHub:
> ```bash
> npm install github:yerba-buena/flowhub-client-ts
> ```

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

## License

[MIT](./LICENSE)
