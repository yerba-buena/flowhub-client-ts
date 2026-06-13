---
"@yerba-buena/flowhub-client": minor
---

Add cash-management resource to the internal client.

`FlowhubInternalClient` now exposes `drawers`, `users`, and `rooms` alongside `reports`. The new surface covers Flowhub's drawer / cash-management workflow end-to-end:

- **Drawer CRUD** — `drawers.list / get / create / update / delete`
- **User assignment** — `drawers.assignUser / unassignUser` (drawer ↔ user is many-to-many)
- **Lifecycle** — `drawers.open / close` with full `CountRecord` (denominations + notes + total in cents)
- **Cash events** — `drawers.payIn / payOut / drop / pop` (total in cents, reason, performing userId)
- **Audit feed** — `drawers.listActivity` over a date range
- **Tips** — `drawers.listTips` keyed by `drawer.counts.id`
- **Receipt PDFs** — `drawers.buildReceiptUrl` (pure URL builder) and `drawers.downloadReceipt` (fetches the PDF as a `Buffer`)
- **`DrawerWatcher`** — polls `drawers.list()` on a cadence, diffs each snapshot, and emits a typed `AsyncIterable<DrawerEvent>` with 11 event kinds (`drawer.created/.deleted/.opened/.closed/.updated`, `user.assigned/.unassigned`, `cash.payIn/.payOut/.drop/.pop`). True backpressure via async generator — polling waits for the consumer to pull each event.

Types include the full `Drawer`, `DrawerCounts`, `CountRecord`, `Denominations`, `CashEvent`, `DrawerActivity`, `DrawerTip`, `User`, `Room`, and `DrawerEvent` discriminated union. Money is integer cents throughout (documented per field). Server-side quirks (`DrawerCounts.ClosedAt` capitalisation, `CashEvent` snake_case fields) are preserved verbatim to match the wire format.

All methods reuse the existing `SessionAuth` token lifecycle, retry once on 401, and surface failures through the existing `FlowhubError` hierarchy. No new error classes.

Live integration tests against the production Flowhub instance are gated behind four env vars (`FLOWHUB_LIVE_TEST=1`, `FLOWHUB_LIVE_TEST_CONFIRM=I-UNDERSTAND-THIS-HITS-PRODUCTION`, `FLOWHUB_TEST_DRAWER_ID`, `FLOWHUB_TEST_USER_ID`) with pre-flight checks and best-effort cleanup. Unit tests use mocked HTTP with MSW.
