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
  console.log(`${loc.id}: ${loc.name}`);
}
```

## Error handling

All errors are typed — you never get raw fetch errors:

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
  baseUrl: "https://api.flowhub.co", // optional
  timeout: 30_000,                   // optional, default 30s
  retries: 3,                        // optional, default 3
});
```

## Multi-location

```ts
const cobbleHill = flowhub.forLocation("loc_abc123");
const { data } = await cobbleHill.locations.list();
```

## Disclaimer

See [DISCLAIMER.md](./DISCLAIMER.md). This is an unofficial project maintained by Yerba Buena Brands, LLC.

## License

[MIT](./LICENSE)
