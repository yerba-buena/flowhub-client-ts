# @yerba-buena/flowhub-client

Unofficial TypeScript client for the [Flowhub](https://flowhub.co) API. Not affiliated with or endorsed by Flowhub, Inc.

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
const { data: locations } = await flowhub.locations.list({ limit: 10 });

for (const loc of locations) {
  console.log(`${loc.locationId}: ${loc.locationName}`);
}
```

## Inventory

```ts
// List all inventory
const { data: items } = await flowhub.inventory.list({ limit: 50 });

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

// Async iteration over all pages
for await (const item of flowhub.inventory.iterate()) {
  console.log(`${item.productName}: ${item.quantity} ${item.category}`);
}
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
  await flowhub.locations.get("nonexistent");
} catch (err) {
  if (err instanceof FlowhubNotFoundError) {
    console.log("Not found");
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

## Disclaimer

See [DISCLAIMER.md](./DISCLAIMER.md). This is an unofficial project maintained by Yerba Buena Brands, LLC.

## License

[MIT](./LICENSE)
