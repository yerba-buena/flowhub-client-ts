# Flowhub Internal (Unofficial) API Reference

Flowhub's **public** API is mirrored in plaintext at
[`yerba-buena/flowhub-api-docs`](https://github.com/yerba-buena/flowhub-api-docs).
That mirror only covers the documented, public API (locations, products,
inventory, orders, order-ahead).

This document is the **counterpart for the *internal* surface** — the
endpoints `app.flowhub.com` uses that are **not** in the public API and
therefore **not** in that mirror. Everything here was reverse-engineered from
HAR captures of the Flowhub dashboard and is implemented behind the
`@yerba-buena/flowhub-client/internal` entry point (`FlowhubInternalClient`).

> ⚠️ **Unofficial and unstable.** None of this is documented or supported by
> Flowhub. It authenticates with dashboard **email + password** (not an API
> key), has no stability contract, and can change or break without notice. See
> [`src/internal/README.md`](../src/internal/README.md) for the usage guide,
> credential-handling guidance, and stability caveats.

## Transport & auth

| | Detail |
|---|---|
| **Base URL** | `https://api.flowhub.com` (note `.com`, vs the public API's `.co`) |
| **GraphQL** | `POST /graph/query` (most ops), `POST /analytics/query` (reports metadata) |
| **REST** | `GET /analytics/<reportId>` (CSV bytes), `GET /printing/drawer/...` (PDF bytes) |
| **Auth header** | `Authorization: <session-uuid>` — the bare UUID from the `Login` mutation, **no `Bearer` prefix** |
| **Required header** | `Origin: https://app.flowhub.com` |
| **Token** | `Login` mutation returns `{ id, refreshId, expireTime }`; ~4-hour lifetime; client re-logs in on 401 |
| **IDs / money / time** | All entity IDs are UUIDs; money is integer cents; timestamps are ISO 8601 |

## Surface catalog

Operations grouped by client resource. ✅ = wrapped by the client today;
🔲 = mapped/runbook'd but not yet implemented (awaiting a HAR capture).

### Reports — `internal.reports` ✅
CSV analytics exports. Metadata via GraphQL `GetReports` (`/analytics/query`);
downloads via `GET /analytics/<reportId>?start_date&end_date&store_id`.
~60 report IDs. → [`reports-discovery.md`](./reports-discovery.md)

### Cash management / drawers — `internal.drawers` ✅
GraphQL at `/graph/query`. Queries: `GetDrawers`, `GetDrawerActivities`,
`GetDrawerTips`. Mutations: `CreateDrawer`, `UpdateDrawer`, `DeleteDrawer`,
`OpenDrawer`, `CloseDrawer`, `AddDrawerUser`, `RemoveDrawerUser`, `MakeDrop`,
`MakePop`, `MakePayin`, `MakePayout`. Receipt PDFs via
`GET /printing/drawer/{countId}/{kind}`. A `DrawerWatcher` polls + diffs.
→ [`cash-management-discovery.md`](./cash-management-discovery.md)

### Employees / staff roster — `internal.employees` ✅
GraphQL `filteredUsers` field: `GetAllUsers` (limit/offset paginated roster) and
`GetOneUser` (by id). Provides the deterministic `email → id` mapping where `id`
is **verified** to equal the sale seller id (`Sale.soldBy.id` / `budtenderId`).
→ [`employees-discovery.md`](./employees-discovery.md)

### Sales — `internal.sales` ✅
GraphQL `filteredSales` field (`GetSales`, for both list and single-sale lookup).
Read-only completed sales with `soldBy { id }` (the seller's user UUID, equal to
the `employees` id), an `employeeIds` filter for per-budtender views, money in
integer cents, items, and loyalty. → [`sales-discovery.md`](./sales-discovery.md)

### Users (drawer assignment) — `internal.users` ✅
GraphQL `GetUsers` (`storeUsers`) — a lighter user list used when assigning
users to drawers. (The richer roster lives on `employees`, above.)

### Rooms — `internal.rooms` ✅
GraphQL `GetRooms` → `[{ id, name, isForSale }]`.

### Products & inventory (catalog edit, batch/package edit, inventory log) 🔲
Not yet implemented — the Inventory app's product/inventory/log operations are
dashboard-only GraphQL but haven't been captured. Interim read-only data is
available via reports (`inventory-activity`, `product-activity`,
`product-catalog-full-details`, …). Capture runbook:
→ [`product-inventory-discovery.md`](./product-inventory-discovery.md)
(issues [#6](https://github.com/yerba-buena/flowhub-client-ts/issues/6),
[#7](https://github.com/yerba-buena/flowhub-client-ts/issues/7),
[#8](https://github.com/yerba-buena/flowhub-client-ts/issues/8))

### Deals 🔲
No public deals API at all; create/edit is dashboard-only GraphQL, not yet
captured. Interim read-only via the `deals-usage` / `deals-full-details`
reports. Capture runbook: → [`deals-discovery.md`](./deals-discovery.md)
(issue [#9](https://github.com/yerba-buena/flowhub-client-ts/issues/9))

## Discovery docs index

Each doc records the HAR-captured findings (operations, variable/response
shapes, quirks) and/or a capture runbook for surfaces not yet captured.

| Doc | Surface | Status |
|---|---|---|
| [`reports-discovery.md`](./reports-discovery.md) | CSV reports | captured ✅ |
| [`cash-management-discovery.md`](./cash-management-discovery.md) | Drawers / cash events | captured ✅ |
| [`employees-discovery.md`](./employees-discovery.md) | Staff roster (read) | captured ✅ |
| [`sales-discovery.md`](./sales-discovery.md) | Sales (read) | captured ✅ |
| [`product-inventory-discovery.md`](./product-inventory-discovery.md) | Products / inventory / log | runbook 🔲 |
| [`deals-discovery.md`](./deals-discovery.md) | Deals | runbook 🔲 |
| [`plans/`](./plans/) | Resource design plans | — |

## How new internal endpoints get added

The reverse-engineering pipeline (see any discovery doc for the full runbook):

1. **Capture** a HAR of the relevant dashboard action (DevTools → Network), or
   use [`scripts/instrument-flowhub.js`](../scripts/instrument-flowhub.js) to
   log + dump the GraphQL ops as a redacted JSON.
2. **Extract** the Flowhub GraphQL POSTs with
   [`scripts/extract-graphql-from-har.mjs`](../scripts/extract-graphql-from-har.mjs)
   (redacts the session token + passwords).
3. **Document** the operation/variable/response shapes in a discovery doc.
4. **Implement** a resource on `FlowhubInternalClient`, mirroring the existing
   ones, with types + MSW unit tests.

> **Security:** a raw HAR contains your live session token (~4h). Never post one
> in a public issue/PR; prefer the redacted instrumentation JSON, and log out
> after capturing. `*.har` is git-ignored.
