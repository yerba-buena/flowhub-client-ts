# Cash management resource — implementation plan

## Context

The dashboard module (`src/dashboard/`) currently exposes one resource:
`reports`, for downloading CSV reports. Discovery against the live
production Flowhub instance (see [`docs/cash-management-discovery.md`](../cash-management-discovery.md))
captured the full GraphQL surface for cash management — drawers, drawer
lifecycle, user assignment, the four cash-event mutations, the activity
feed, and the receipt-printing endpoints. None of these exist in
Flowhub's public API.

This plan covers adding a `drawers` resource (plus supporting `users` and
`rooms` resources, and a `watch` event helper) to the dashboard module.
The goal is to make it possible to:

1. Build a cash-management tool that **syncs in real time** with Flowhub —
   detecting drops, pops, pay-ins, pay-outs, drawer opens, drawer closes,
   and user-assignment changes as they happen at the POS.
2. **Drive** cash events from outside the Flowhub dashboard — so that
   tool can record a drop or pay-in and have Flowhub know about it.

Sync is the primary use case. Driving is secondary but important enough
to include in the same resource (the mutations are already half the
work).

## Retail vocabulary

These four event types exist because cash is harder to audit than card.
Without explicit events for every dollar that moves, a missing $100
could be theft, a miscount, or a legitimate expense — and you can't tell
which. Each event captures *who* moved cash, *how much*, and *why*.

**Drop** — *Cash leaves the drawer to be deposited.* The till gets too
full; the manager pulls cash out and locks it in the back-office safe
(later to the bank). Cash balance decreases, no expense is recorded —
the money is still the company's, just sitting somewhere else.
- *Example:* mid-shift, the till has $2,000. Manager removes $1,500 to
  the safe. Drop of $1,500.

**Pop** — *The drawer opens with no cash moving in or out.* The "No
Sale" button on a traditional register. Used to make change, fix a
miscount, or open the drawer when there's no transaction. Total is
typically $0. Recorded who/why purely for audit/anti-theft.
- *Example:* a customer pays $20 for a $19 item, the till has no $1
  bills, the cashier pops the drawer to grab change from another
  compartment. No money moved.

**Pay-in** — *Cash enters the drawer from outside normal sales.* Seeding
change, replenishing small bills, moving cash between drawers, or a
manager topping up the till. Increases cash balance, no revenue
recorded — it's a transfer, not a sale.
- *Example:* the till is short on $5 bills. Manager takes $50 of fives
  from the safe and pays them into the drawer. Pay-in of $50.

**Pay-out** — *Cash leaves the drawer to pay for something or someone,
not as a deposit.* Paying a delivery driver in cash, tipping out staff,
buying emergency supplies. Decreases cash balance AND is recorded as
**negative revenue** because money left to pay for something — like a
tiny expense entry.
- *Example:* juice delivery driver wants $40 cash. Cashier pulls $40
  from the till. Pay-out of $40 with reason "Juice delivery".

**Why drop ≠ pay-out for accounting:** drop is internal (cash moves
within the company); pay-out leaves the company. **Why pay-in ≠ sale:**
a sale generates revenue and tax liability; a pay-in does not.

In Flowhub's API all four have an identical shape
(`{ drawerId, <event>: { total, reason, userId } }`) but they land in
separate arrays on `DrawerCounts` and roll up to separate aggregates
(`totalPaidIn`, `totalPaidOut`, `totalDropped`, plus negative impact on
`cashRevenue` for pay-outs only).

## Architecture

Add to `src/dashboard/` alongside `reports.ts`. Reuse the existing
`SessionAuth` and `DashboardHttp.graphql()`. No new auth path; no new
HTTP layer.

```
src/
  dashboard/
    cash-management.ts          # DrawersResource class — main surface
    cash-management-types.ts    # Drawer, DrawerCounts, CountRecord, etc.
    cash-management-watch.ts    # DrawerWatcher — poll + diff helper
    users.ts                    # UsersResource (small)
    rooms.ts                    # RoomsResource (small)
    client.ts                   # add drawers / users / rooms to FlowhubDashboardClient
    index.ts                    # re-export new types
tests/
  dashboard/
    cash-management.test.ts     # mocked HTTP unit tests
    cash-management-watch.test.ts
    users.test.ts
    rooms.test.ts
  integration/
    cash-management-live.test.ts # gated by env var, hits real Flowhub
docs/
  cash-management-discovery.md  # already done — source of truth for shapes
```

Match the existing pattern: small single-file resources, types in
dedicated files, no shared barrel beyond what `index.ts` re-exports.

## Types

Mirror the captured GraphQL shapes verbatim. Notable quirks to preserve:

- **Money is integer cents throughout.** Type as `number`. Document the
  unit in every relevant field's JSDoc.
- **`DrawerCounts.ClosedAt`** — capitalised, server-side typo. Preserve.
- **`payins` / `payouts` / `drops` / `pops` array items use snake_case**
  for `balance_after`, `balance_before`, `user_id` while the rest of the
  response is camelCase. Preserve.
- **Drawer state is derived**, not enum'd:
  `notYetOpened = openedAt == null`,
  `open = openedAt != null && closedAt == null`,
  `closed = closedAt != null`.
- **All entity IDs are UUIDs** — type as `string`.
- **Timestamps are ISO 8601**; event timestamps include nanoseconds.

```ts
export type DrawerType = "REC" | "MED";  // observed values only

export interface Drawer {
  id: string;
  name: string;
  type: DrawerType | string;     // string fallback; we've only seen REC
  openedAt: string | null;
  closedAt: string | null;
  dropTriggerBalance: number;    // cents
  needsDrop: boolean;
  rooms: ReadonlyArray<{ id: string; name: string }>;
  users: ReadonlyArray<DrawerUser>;
  counts: DrawerCounts | null;
}

export interface DrawerUser {
  id: string;
  email: string;
  meta: { firstName: string; lastName: string };
}

export interface CountRecord {
  total: number;        // cents
  notes: string;
  denominations: Denominations;
}

export interface Denominations {
  pennies: number | null;
  nickels: number | null;
  dimes: number | null;
  quarters: number | null;
  ones: number | null;
  twos: number | null;
  fives: number | null;
  tens: number | null;
  twenties: number | null;
  fifties: number | null;
  hundreds: number | null;
}

export interface CashEvent {
  id: string;
  total: number;        // cents
  reason: string;
  timestamp: string;    // ISO 8601 with nanoseconds
  user_id: string;
  balance_before: number;
  balance_after: number;
}

export interface DrawerCounts {
  id: string;
  drawerId: string;
  openedAt: string | null;
  openedByUser: DrawerUser | null;
  ClosedAt: string | null;       // server typo preserved
  closedByUser: DrawerUser | null;
  openingCashBalance: number;
  cashBalance: number;
  closingCashBalance: number;
  openingCounts: CountRecord | null;
  closingCounts: CountRecord | null;
  cashRevenue: number;
  debitRevenue: number;
  achRevenue: number;
  giftCardRevenue: number;
  debitBalance: number;
  achBalance: number;
  debitTipRevenue: number;
  closingDebitBalance: number;
  closingRevenue: number;
  payins: ReadonlyArray<CashEvent> | null;
  payouts: ReadonlyArray<CashEvent> | null;
  drops: ReadonlyArray<CashEvent> | null;
  pops: ReadonlyArray<CashEvent> | null;
  totalPaidIn: number;
  totalPaidOut: number;
  totalDropped: number;
  totalRevenueSinceOpen: number;
}

export interface DrawerActivity {
  actionTimestamp: string;
  action: "create" | "update" | "open" | "close" |
          "drop" | "pop" | "payin" | "payout" | string;
  subaction: string | null;       // e.g. "add user", "remove user"
  employeeName: string;
  snapshot: Drawer;
  changedValues: DrawerActivityChanges | null;
}

// (DrawerActivityChanges type stubbed against captured "update" shape)

export interface DrawerTip {
  name: string;
  amount: number;       // cents
}
```

**Empirical TODO** (see test strategy): confirm `DrawerType` accepts only
`REC`/`MED` (try `"OTHER"` and see what fails), confirm activity feed
`action` values for non-update events. These don't block the resource —
fall back to `string` until confirmed.

## `DrawersResource` API

Lives in `src/dashboard/cash-management.ts`. Each method is a thin wrapper
over one GraphQL operation, mirroring the structure of
`src/dashboard/reports.ts`.

```ts
class DrawersResource {
  // --- Reads ---
  list(params?: {
    hidden?: boolean;
    orderBy?: string;
    orderDirection?: "asc" | "desc";
  }): Promise<Drawer[]>;

  get(id: string): Promise<Drawer | null>;

  listActivity(
    drawerId: string,
    params: { startDate: string; endDate: string }
  ): Promise<DrawerActivity[]>;

  listTips(drawerCountId: string): Promise<DrawerTip[]>;

  // --- Drawer CRUD ---
  create(input: {
    name: string;
    type: DrawerType;
    rooms: string[];                // room IDs
    dropTriggerBalance: number;     // cents
  }): Promise<Drawer>;

  update(id: string, input: {
    name: string;
    type: DrawerType;
    rooms: string[];
    dropTriggerBalance: number;
  }): Promise<Drawer>;

  delete(id: string): Promise<void>;

  // --- User assignment ---
  assignUser(drawerId: string, userId: string): Promise<Drawer>;
  unassignUser(drawerId: string, userId: string): Promise<Drawer>;

  // --- Lifecycle ---
  open(id: string, count: CountRecord): Promise<Drawer>;
  close(id: string, count: CountRecord): Promise<Drawer>;

  // --- Cash events ---
  payIn(drawerId: string, params: CashEventParams): Promise<Drawer>;
  payOut(drawerId: string, params: CashEventParams): Promise<Drawer>;
  drop(drawerId: string, params: CashEventParams): Promise<Drawer>;
  pop(drawerId: string, params: CashEventParams): Promise<Drawer>;

  // --- Receipts ---
  buildReceiptUrl(opts: {
    drawerCountId: string;
    kind: "open" | "close" | "drop" | "pop" | "payin" | "payout";
    eventId?: string;   // required for drop/pop/payin/payout
  }): string;

  downloadReceipt(opts: ReceiptOptions): Promise<{ data: Buffer; contentType: string }>;
}

interface CashEventParams {
  total: number;        // cents
  reason: string;
  userId: string;
}
```

**Naming choice — `Make*` vs friendlier verbs:** the GraphQL op names are
`MakeDrop` / `MakePop` / `MakePayin` / `MakePayout`. The resource exposes
them as `drop()` / `pop()` / `payIn()` / `payOut()` — shorter and matches
how the actions are described in retail and in the dashboard UI. The
underlying op name is an implementation detail.

**Validation in the resource:** keep it minimal — required-field checks,
no value-range validation. We don't know Flowhub's server-side validation
rules. Let the server reject what it rejects; map errors via the existing
`FlowhubError` hierarchy. (Empirical tests will document what we learn.)

## `UsersResource` and `RoomsResource`

Small, read-only:

```ts
class UsersResource {
  list(params?: {
    storeUsers?: boolean;
    storeId?: string;
    storeIds?: string[];
    status?: string;
    orderBy?: string;
    isInternal?: boolean;
  }): Promise<User[]>;
}

class RoomsResource {
  list(): Promise<Room[]>;
}
```

These exist mostly to support drawer flows (assign user → need to know
user IDs; create drawer → need to know room IDs). Don't add write
methods; user/role management is its own domain we don't need.

## `DrawerWatcher` — sync helper

The headline feature. Polls `GetDrawers` and emits an async iterable
stream of events derived by diffing against the previous snapshot.

```ts
class DrawerWatcher {
  constructor(opts: {
    drawers: DrawersResource;
    intervalMs?: number;        // default 5000 — matches dashboard cadence
    drawerIds?: string[];       // optional — watch only these
    onError?: (err: Error) => void;
  });

  events(): AsyncIterable<DrawerEvent>;

  start(): Promise<void>;
  stop(): Promise<void>;
}

type DrawerEvent =
  | { kind: "drawer.created"; drawer: Drawer }
  | { kind: "drawer.deleted"; drawerId: string }
  | { kind: "drawer.opened"; drawer: Drawer }
  | { kind: "drawer.closed"; drawer: Drawer }
  | { kind: "drawer.updated"; drawer: Drawer; previous: Drawer }
  | { kind: "user.assigned"; drawer: Drawer; user: DrawerUser }
  | { kind: "user.unassigned"; drawer: Drawer; user: DrawerUser }
  | { kind: "cash.payIn"; drawer: Drawer; event: CashEvent }
  | { kind: "cash.payOut"; drawer: Drawer; event: CashEvent }
  | { kind: "cash.drop"; drawer: Drawer; event: CashEvent }
  | { kind: "cash.pop"; drawer: Drawer; event: CashEvent };
```

**Diff algorithm:**

1. On first poll: snapshot all drawers, emit nothing (the snapshot is
   the baseline). Optionally support `emitInitial: true` to emit
   `drawer.created` for every drawer on first poll.
2. Subsequent polls: for each drawer present in both snapshots, diff:
   - `openedAt: null → string` → `drawer.opened`
   - `closedAt: null → string` → `drawer.closed`
   - `users[]` membership change → `user.assigned` / `user.unassigned`
   - New IDs in `counts.payins[]` → `cash.payIn` (one event per new ID)
   - Same for payouts / drops / pops
3. Drawers present in new but not old → `drawer.created`.
4. Drawers present in old but not new → `drawer.deleted`.
5. Emit events ordered by their `timestamp` field where available, else
   by poll order.

**Error handling:**
- Transient errors (network, 5xx, 429): retry with exponential backoff
  capped at `intervalMs * 6`. Don't emit events for that poll. Notify
  via `onError`.
- 401: `SessionAuth` already handles by re-logging in. Pass through.
- Other errors: surface via `onError`; continue polling.

**Memory:**
- Keep the previous snapshot. Don't accumulate history beyond that.
- Optionally support an external "checkpoint" function for resuming
  across process restarts (deferred — phase 6).

## Receipt PDFs

`buildReceiptUrl()` is a pure URL builder — no network call. Useful for
embedding in UIs without needing to fetch the PDF server-side.

`downloadReceipt()` fetches the PDF as a `Buffer` via the existing
`DashboardHttp` (extend to support `Accept: application/pdf` on non-
GraphQL paths). Reuses `SessionAuth` for the Authorization header.

URL pattern:
```
GET /printing/drawer/{drawerCountId}/open
GET /printing/drawer/{drawerCountId}/close
GET /printing/drawer/{drawerCountId}/{drop|pop|payin|payout}/{eventId}
```

Empirically confirm: response Content-Type, content-disposition,
behavior for invalid IDs. Test plan covers.

## Test plan

Two layers: mocked unit tests (run by default), and empirical
integration tests against the **live production Flowhub instance**
(gated, opt-in, with strict safety controls).

### Unit tests — `tests/dashboard/cash-management.test.ts`

For each resource method:
- Happy path: mock returns canned response → method returns parsed result
- Variable shape: capture the outgoing GraphQL operation name + variables
  and assert they match what we observed in the discovery captures
- Error mapping: 401 → `FlowhubAuthError`, 429 → `FlowhubRateLimitError`,
  etc.
- 401 retry-once: same pattern as reports.ts

For `DrawerWatcher`:
- Initial snapshot emits nothing by default; emits `drawer.created` for
  each when `emitInitial: true`
- Diff detection for each event type — drive by feeding canned drawer
  snapshots, assert event sequence
- New event in `counts.payins[]` emitted exactly once even across polls
- Stop is idempotent and prevents further emissions
- Error handler invoked on transient failure; iterator does not throw

### Empirical integration tests — `tests/integration/cash-management-live.test.ts`

**These tests hit the real Flowhub production instance.** They MUST be
gated, MUST clean up after themselves, MUST use a designated test
drawer, MUST use trivial amounts.

**Gating (all must be true to run):**
- Env var `FLOWHUB_LIVE_TEST=1`
- Env var `FLOWHUB_TEST_DRAWER_ID` set to a UUID
- Env var `FLOWHUB_TEST_USER_ID` set to a UUID (the user who'll be
  recorded as having performed cash events)
- Env var `FLOWHUB_LIVE_TEST_CONFIRM=I-UNDERSTAND-THIS-HITS-PRODUCTION`
  (verbatim — prevents accidental runs via stale env vars)

**Pre-flight (run once, manually):**
1. In the Flowhub dashboard, create a drawer named `DO-NOT-USE-AUTOMATED-TEST`
   in a non-customer-facing room. Assign no users initially.
2. Note its UUID; set `FLOWHUB_TEST_DRAWER_ID`.
3. Use a service-account user (not a real cashier). Note that user's UUID;
   set `FLOWHUB_TEST_USER_ID`.

**Per-test hygiene:**
- All cash events use `total: 1` (one cent).
- All `reason` fields start with `AUTOMATED-TEST: ` and include the test
  name and a timestamp.
- All count notes start with `AUTOMATED-TEST FAKE DATA`.
- Every test wraps its actions in `try/finally`. The `finally` block
  closes the drawer if it's open and removes any assigned users — even
  if the test failed. Use a "best effort, swallow errors" cleanup.
- A `beforeAll` hook asserts the test drawer is currently closed and
  has no users assigned, refusing to run if not (so a previous failed
  run can't compound).
- An `afterAll` hook performs a final verification + cleanup pass.

**Coverage (one test per behavior, in order):**

1. `list()` returns the test drawer
2. `get(testDrawerId)` returns it with expected name
3. `assignUser` then `unassignUser` against the test drawer
4. `open` with a minimal count (1 cent in `pennies`, total `1`)
5. `payIn` 1 cent — assert `counts.payins[]` length incremented and the
   new event has the expected `total`, `reason`, `user_id`
6. `payOut` 1 cent — same
7. `drop` 1 cent — same
8. `pop` 0 cents — same (`pops[]` increments; balance unchanged)
9. `close` with a count of 1 cent
10. `listActivity` for the just-opened-and-closed test drawer
11. `listTips` for the drawer count
12. `buildReceiptUrl` + `downloadReceipt` for one of each receipt kind
13. `update` (no-op save) — confirm tolerated

**Out of scope for automated live tests:**
- `create` + `delete` against production (creates persistent artefacts;
  rely on manual + mocked tests for these)
- Sustained polling via `DrawerWatcher` against production (run only
  manually with a short interval and tight timeout)

### Empirical discovery tests — `tests/integration/cash-management-explore.test.ts`

Optional, opt-in via `FLOWHUB_EXPLORE_TEST=1` plus the same gating. Tests
that confirm or refute the schema unknowns:

- Try `type: "OTHER"` in `create` → expect rejection; record error shape
- Try `payOut` larger than current balance → record whether allowed
- Try `payIn` with negative total → record validation behavior
- Try `assignUser` with an unknown user ID → record error
- Try `open` on already-open drawer → record error
- Try `close` on not-yet-opened drawer → record error
- Fetch activity feed AFTER a drop/pop/payin/payout to confirm
  `action` values

Results get folded back into the discovery doc as a "Validation notes"
section. None of these are correctness-blocking for the initial release.

## Implementation order

Build in vertical slices so each phase is shippable. Don't merge
phases — separate PRs makes review tractable.

**Phase 1 — Types + read-only resource.** `cash-management-types.ts`,
`DrawersResource.list` / `get` / `listActivity` / `listTips`,
`UsersResource.list`, `RoomsResource.list`. Mocked unit tests for all.

**Phase 2 — Drawer CRUD + user assignment.** `create` / `update` /
`delete` / `assignUser` / `unassignUser`. Mocked tests.

**Phase 3 — Lifecycle.** `open` / `close`. Mocked tests + at least one
live integration test if the safety gating is in place.

**Phase 4 — Cash events.** `payIn` / `payOut` / `drop` / `pop`. Mocked
tests + live integration tests with strict cleanup.

**Phase 5 — Watcher.** `DrawerWatcher` and its diff algorithm.
Comprehensive mocked tests. Live test runs only manually.

**Phase 6 — Receipts.** `buildReceiptUrl` (pure, easy) +
`downloadReceipt` (extends `DashboardHttp` for binary GET on non-
analytics paths). Live test for one receipt of each kind.

**Phase 7 — Docs + changeset.** Update `src/dashboard/README.md` with
the new surface. Add a changeset (minor version bump). Don't add to the
main `README.md` other than maybe one bottom-of-file reference.

## Conventions

- Follow biome formatting + lint config already in the repo.
- TypeScript: strict, no `any`. Use `unknown` + type guards when parsing
  GraphQL responses defensively.
- Errors: reuse `FlowhubError` / `FlowhubAuthError` /
  `FlowhubRateLimitError` / `FlowhubNotFoundError` /
  `FlowhubValidationError`. Don't introduce new error classes.
- GraphQL queries: store the exact query strings captured from the
  dashboard verbatim (with the shared fragments). Don't simplify — the
  server may rely on the response shape matching the fragments.
- Money: always document units (`cents`) in JSDoc.
- IDs: type as `string`, JSDoc as `UUID`.
- Never log credentials, tokens, or full user data at any level.

## What NOT to do

- Don't add a CLI. This is a library.
- Don't parse activity feed timestamps into Date objects in this PR —
  leave as strings, let the consumer decide.
- Don't try to model `action` / `subaction` as a discriminated union
  exhaustively; use a string union with fallback `string`. We can
  tighten as empirical findings land.
- Don't expose `SessionAuth` or internal HTTP helpers from the
  dashboard entry point.
- Don't run live integration tests in CI by default. The gating env
  vars must be opt-in per-run, never set in CI config.
- Don't include money values in error messages or logs beyond what the
  server returns (which we should sanitise before re-raising).
- Don't speculate about endpoints we didn't capture. If we need
  something new, capture it first.

## Deliverable per phase

For each phase PR:
1. Source files for the phase, no more
2. Tests passing (unit; live if applicable and gated locally)
3. Discovery doc updated with any new empirical findings
4. Changeset added (defer the version bump until phase 7 if you want a
   single release covering all of cash management)
