---
"@yerba-buena/flowhub-client": minor
---

Add client-side rate-limit handling to `FlowhubClient` (resolves #15).

The public Flowhub API rejects bursts with HTTP 429. The client now helps callers stay under the limit and degrade gracefully:

- **Client-side throttle (on by default).** A shared token-bucket limiter paces outbound requests, defaulting to a conservative ~45 req/s (below the ~59 req/s downstream apps have observed). Configure via `rateLimit: { rps, burst }`; pass `{ rps: 0 }` to disable.
- **Smarter 429 handling.** Retries now use **full-jitter** exponential backoff (configurable via `jitter: "full" | "equal" | "none"` and `maxDelayMs`). When the server provides a wait hint — `Retry-After` (delta-seconds or HTTP-date), `Retry-After-Ms`, or `X-RateLimit-Reset[-After]` / `RateLimit-*` — it is honored instead of generic backoff.
- **Rate-limit visibility.** `FlowhubRateLimitError` now carries `limit`, `remaining`, and `resetAt` (alongside `retryAfter`) when the server sends those headers. A new `onRateLimit(info)` option is called whenever rate-limit headers appear on any response, so callers can self-pace. `RateLimitOptions` / `RateLimitInfo` / `JitterMode` types are exported.
- **Docs.** `PaginationParams.created_after` / `created_before` are documented as the recommended way to bound list queries (the biggest lever for call-volume reduction), and the README gains a "Rate limiting" section.

Note: the throttle is **on by default**, a behavior change — high-throughput callers can raise `rateLimit.rps` or disable it.
