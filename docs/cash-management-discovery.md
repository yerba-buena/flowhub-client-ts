# Flowhub Cash Management — Discovery Capture Runbook

> Status: **awaiting capture**. This document is a runbook for you to follow in
> the Flowhub dashboard so we can reverse-engineer the cash-management
> endpoints. Once you send me the resulting HAR + console dump, I'll extract
> the operations, append findings to this doc, and design the resource API.

## Background

Flowhub's public API has no cash-management endpoints — no drawer open/close,
no user-to-drawer assignment, no pay-in / pay-out / cash drop. The dashboard
at `app.flowhub.com` performs all of these internally via GraphQL operations
against `https://api.flowhub.com/graph/query` (the same endpoint the existing
`src/dashboard/` module already uses for login and reports metadata).

The plan is to extend the dashboard module with a `cash-management.ts`
resource that calls those same operations through the existing `SessionAuth`
+ `DashboardHttp.graphql()` flow. We just need to see what the dashboard
sends when each action happens.

The CSV reports `drawers-new` and `drawers-activity` already give batch
visibility into drawer activity after the fact, but they aren't suitable for
real-time sync. The GraphQL operations we're after are what the dashboard
itself uses to list and create these records — much closer to a live feed.

## Pre-flight checklist

- Use a **non-production store** if you have one. Pay-ins and pay-outs you
  record here will post to a real ledger.
- Use **small dollar amounts** (e.g. $1) so any cleanup is trivial.
- Use **Chrome** (Edge / Brave are fine too). Firefox HAR exports work but
  the format differs slightly — the existing dashboard module was built
  against Chrome HARs.
- **Log out fully** before starting, so the Login mutation is captured in the
  same recording. (We already have the Login shape, but lining it up with
  the other ops in one HAR makes review easier.)
- Have a **scratchpad open** (paper, Notes, whatever). You'll jot down each
  action you take with rough timestamps so we can map captured requests to
  user actions when reviewing.

## Step 1 — Open DevTools and start recording

1. In the dashboard tab, open DevTools (`Cmd+Opt+I` on Mac,
   `Ctrl+Shift+I` on Windows/Linux).
2. Switch to the **Network** tab.
3. Check **Preserve log**.
4. Check **Disable cache**.
5. (Optional) Set the request filter to **Fetch/XHR** so the panel isn't
   cluttered with image and font loads.
6. Click the round record button if it isn't already red.
7. Click the 🚫 (clear) button so the log starts empty.

## Step 2 — Install the console instrumentation (optional but recommended)

In the same tab, open the **Console** panel and paste the entire contents
of [`scripts/instrument-flowhub.js`](../scripts/instrument-flowhub.js), then
hit Enter. You should see:

```
[flowhub-instrument] installed. Perform actions, then call:
  window.__flowhubInstrument.summary()  // operation counts
  window.__flowhubInstrument.dump()     // download captured ops as JSON
```

This logs every Flowhub GraphQL operation as it fires (operation name,
variables, response) so you can see in real time whether each action
produced a request and what it was called. It also lets you download a
redacted JSON file at the end that's much smaller and easier to share than
a full HAR.

If you skip this step, the HAR alone is enough — the console snippet is
purely a convenience.

## Step 3 — Perform the actions in the dashboard

You can capture **one HAR per action** (recommended — easier to attribute
ops to actions, smaller files, can be done over multiple sessions) or
**one combined HAR** with everything in sequence (faster if you're doing
it all in one sitting).

**Per-action workflow:** between actions, click the 🚫 clear button in
the Network panel, then perform the next action, then save the HAR with
the filename listed in each step below. If you ran the console snippet,
also run `window.__flowhubInstrument.reset()` between actions and
`window.__flowhubInstrument.dump()` after each one if you want the
companion JSON.

**Combined workflow:** just leave recording on and walk through all the
steps, then save one big HAR at the end.

Either way, write a quick note on your scratchpad for each action:
roughly what time, what amount you entered, and any memo text. We'll use
those notes to match captured ops to actions.

If any action doesn't exist in your dashboard (e.g. your store doesn't
have a separate "cash drop" action), skip it and note that it didn't
apply.

### Per-action capture sequences

Filenames assume the per-action workflow. Adjust the date suffix.

**Sequence 1 — Login** (`01-login-YYYY-MM-DD.har`)

1. If you're currently logged in, log out via the profile/gear menu.
2. Make sure Network is recording and the log is cleared.
3. Log in with your dashboard credentials.
4. Wait for the dashboard home/landing view to fully load.
5. Save HAR.

**Sequence 2 — Navigate to drawers screen** (`02-nav-to-drawers-YYYY-MM-DD.har`)

1. Clear the Network log (do NOT log out).
2. Click your way to the cash management / drawers screen (the entry
   point varies by deployment — often under "POS", "Cash", or "Drawers"
   in the sidebar).
3. Wait for the list / dashboard to fully render.
4. Save HAR.

**Sequence 3 — Open a drawer** (`03-open-drawer-YYYY-MM-DD.har`)

1. Clear the Network log.
2. Click whatever the dashboard's "Open drawer" / "Assign drawer" /
   "Start shift" button is.
3. Fill in opening counts or starting balance — use a small, round
   number (e.g. $100.00) so it's easy to spot in the captured variables.
4. Confirm / submit.
5. Wait for the success state to render.
6. Save HAR. **Scratchpad:** opening amount.

**Sequence 4 — Assign a user to the drawer** (`04-assign-user-YYYY-MM-DD.har`)

After a drawer is open, a user must be assigned to it before pay-ins /
pay-outs can be posted. Capture this in isolation even if your dashboard
sometimes combines it with the open step — we need both shapes to know
whether assigning is a separate mutation or a field on `OpenDrawer`.

1. Clear the Network log.
2. From the open drawer's screen, trigger the assign-user action
   ("Assign User", "Assign Cashier", "Take Drawer", or similar).
3. Pick a user from the dropdown / list. If your test account is the
   only option, that's fine — note the user's name on your scratchpad.
4. Confirm / submit.
5. Save HAR. **Scratchpad:** user assigned + which button you clicked.

**Sequence 5 — Record a pay-in** (`05-pay-in-YYYY-MM-DD.har`)

1. Clear the Network log.
2. Trigger the pay-in flow (button name varies — "Pay In", "Add Cash",
   "Cash In").
3. Amount: **$1.00**. Memo: `test pay-in <short-timestamp>`
   (e.g. `test pay-in 1623`).
4. Confirm / submit.
5. Save HAR. **Scratchpad:** amount + memo.

**Sequence 6 — Record a pay-out** (`06-pay-out-YYYY-MM-DD.har`)

1. Clear the Network log.
2. Trigger the pay-out flow ("Pay Out", "Remove Cash", "Cash Out").
3. Amount: **$1.00**. Memo: `test pay-out <short-timestamp>`.
4. Confirm / submit.
5. Save HAR. **Scratchpad:** amount + memo.

**Sequence 7 — Cash drop / safe drop / deposit** (`07-cash-drop-YYYY-MM-DD.har`)

Skip and note "N/A" if your dashboard doesn't have this as a separate
action from pay-out.

1. Clear the Network log.
2. Trigger the cash-drop flow.
3. Amount: **$1.00**. Memo: `test drop <short-timestamp>`.
4. Confirm / submit.
5. Save HAR. **Scratchpad:** amount + memo.

**Sequence 8 — Refresh drawer activity list** (`08-refresh-activity-YYYY-MM-DD.har`)

This isolates the query our sync code will most want to poll.

1. Clear the Network log.
2. Navigate away from the drawer activity page (to any other dashboard
   page).
3. Navigate back to the drawer activity page.
4. Wait for the list to fully render.
5. Save HAR.

**Sequence 9 — Close the drawer** (`09-close-drawer-YYYY-MM-DD.har`)

1. Clear the Network log.
2. Trigger the close-drawer / end-shift flow.
3. Enter closing counts. They don't need to balance — a $2-ish variance
   is fine and may give us extra fields to model.
4. Finalize / submit.
5. Wait for the success state to render.
6. Save HAR. **Scratchpad:** closing amount + variance shown, if any.

**Sequence 10 — View closed drawer detail** (`10-drawer-detail-YYYY-MM-DD.har`)

Skip if your dashboard doesn't show a per-drawer detail view after close.

1. Clear the Network log.
2. From the drawer activity list, click into the drawer you just closed.
3. Wait for the detail view (counts, activity list, totals) to render.
4. Save HAR.

## Capture results

### Source captures

- `7a5e1912-flowhubdashboardreport.har` (2026-05-24) — single combined HAR
  covering nav + drawer CRUD + user assignment + open/close + drawer detail
  view. Pay-in, pay-out, cash-drop NOT exercised in this capture.

### Endpoint

All cash-management traffic goes to `POST https://api.flowhub.com/graph/query`
with `Authorization: <session-uuid>` (no `Bearer` prefix), same as the
existing reports module. CORS preflight `OPTIONS` requests also fire on every
operation but carry no payload.

### Money & types

- **Money is integer cents.** $300 → `30000`, $1000 drop trigger → `100000`.
- **Drawer state is derived**, not enumerated:
  `open = openedAt != null && closedAt == null`,
  `closed = closedAt != null`,
  `not-yet-opened = openedAt == null`.
- **Drawer ↔ User is many-to-many** via `drawer.users[]`. Assignment is
  managed by `AddDrawerUser` / `RemoveDrawerUser` mutations keyed on
  `{drawerId, userId}`.
- **All entity IDs are UUIDs.**

### Polling query

`GetDrawers` is the single polymorphic query used for both list and detail:

| Variables | Use |
|---|---|
| `{orderBy, orderDirection, hidden}` | List view — fires on a ~5–8s polling interval while the drawers screen is open, plus immediately after every mutation as a refetch. **This is what our sync code polls.** |
| `{id: <drawerUuid>}` | Single-drawer detail — same response shape, filtered to one drawer. |
| `{}` | All drawers, no filter — observed but use case unclear, probably an SSR/hydration fetch. |

Returns `data.drawers[]`, each item is a `Drawer` with this shape (selected
fields):

```
Drawer {
  id, name, type ("REC"|"MED"?), openedAt, closedAt,
  dropTriggerBalance, needsDrop,
  rooms: [{ id, name }],
  users: [{ id, email, meta: { firstName, lastName } }],
  counts: DrawerCounts | null
}

DrawerCounts {
  id, drawerId,
  openedAt, openedByUser,
  ClosedAt, closedByUser,           // note capitalised "ClosedAt" — server typo
  openingCashBalance, cashBalance,
  closingCashBalance,
  openingCounts: CountRecord | null,
  closingCounts: CountRecord | null,
  cashRevenue, debitRevenue, achRevenue, giftCardRevenue,
  debitBalance, achBalance, debitTipRevenue,
  closingDebitBalance, closingRevenue,
  payins, payouts, pops, drops,    // arrays — populated by pay-in/out/drop mutations (NOT YET CAPTURED)
  totalPaidIn, totalPaidOut, totalDropped,
  totalRevenueSinceOpen
}

CountRecord {
  total, notes,
  denominations: {
    pennies, nickels, dimes, quarters,
    ones, twos, fives, tens, twenties, fifties, hundreds
  }
}
```

### Mutations captured

All mutations carry a large shared fragment block (`CountRecordFields`,
`DrawerCountFields`, `DrawerFields`) and return the full updated `Drawer`
on success.

**CreateDrawer**
```
variables: { name, dropTriggerBalance, type, rooms: [roomId...] }
returns:   data.createDrawer = Drawer (with openedAt: null, counts: null)
```

**UpdateDrawer**
```
variables: { id, name, type, rooms: [roomId...], dropTriggerBalance }
returns:   data.updateDrawer = Drawer
```
Observed firing with identical variables on a no-op Edit→Save, so the
server tolerates that. (Edit→Cancel does not fire a mutation.)

**DeleteDrawer**
```
variables: { id }
returns:   data.deleteDrawer = []   // empty array on success
```

**OpenDrawer**
```
variables: {
  id,                  // existing drawer's UUID
  count: CountRecord   // opening count + denominations + free-form notes
}
returns:   data.openDrawer = Drawer (counts.openingCounts, counts.openedAt populated)
```

**CloseDrawer**
```
variables: {
  id,
  count: CountRecord   // closing count
}
returns:   data.closeDrawer = Drawer (counts.ClosedAt, counts.closingCounts populated)
```

**AddDrawerUser** / **RemoveDrawerUser**
```
variables: { drawerId, userId }
returns:   data.addDrawerUser | removeDrawerUser = Drawer  (with users[] updated)
```

### Supporting queries captured

**GetUsers** — `{ storeUsers: true }` returns store-scoped users with id,
email, meta, phoneNumber, stores, role.permissions. Used to populate the
user dropdown when assigning.

**GetRooms** — no variables, returns `[{ id, name, isForSale }]`. Used to
populate the rooms multi-select when creating/editing a drawer.

**GetDrawerTips** — `{ drawerCountId }` returns `[{ name, amount }]`. Fires
when viewing a drawer's detail/counts view between open and close. Likely
relevant for end-of-shift reconciliation but not core to pay-in/out/drop
sync.

### Still missing — needs follow-up capture

The drawer-counts schema includes `payins`, `payouts`, `pops`, `drops`,
`totalPaidIn`, `totalPaidOut`, `totalDropped` fields but none of those
mutations were exercised. Expected operation names (educated guess):
`CreatePayIn` / `RecordPayIn`, `CreatePayOut` / `RecordPayOut`,
`CreateDrop` / `RecordDrop` — but we need to capture them to know for sure.

See "Next capture" in the runbook below.

## Next capture — pay-in / pay-out / cash drop

Combined into a single short capture since they're closely related.

**Pre-flight:**
1. Make sure there's at least one OPEN drawer with a user assigned to it —
   the dashboard probably won't let you pay-in to a closed/unassigned
   drawer. (Open one fresh if needed; you've done it before.)
2. Same DevTools setup as before.

**Sequence A — Pay-in / pay-out / drop** (`pay-actions-YYYY-MM-DD.har`)

1. Clear Network log.
2. Navigate to the open, assigned drawer's detail page.
3. Click **Pay In** → amount $1.00, memo `test pay-in <HHMM>` → confirm.
4. Click **Pay Out** → amount $1.00, memo `test pay-out <HHMM>` → confirm.
5. If your dashboard has a separate **Cash Drop / Safe Drop / Deposit**
   action: → amount $1.00, memo `test drop <HHMM>` → confirm.
6. Wait a few seconds for `GetDrawers` to refetch.
7. Save HAR as `pay-actions-YYYY-MM-DD.har`.

**Scratchpad** (just jot here, no need to capture separately):

- Which button labels did you click for each action?
- Were the actions all reachable from one screen, or did each have its
  own modal / sub-page?
- Did the running drawer total visibly update after each action?

If you don't want to combine them, capture each separately — same file
naming convention as the earlier sequences.

### Combined-capture summary (alternative to per-action)

If you'd rather walk straight through everything in one HAR, the order is:

1. Log out, then log back in.
2. Navigate to the cash management / drawers screen.
3. Open a drawer (note opening amount).
4. Assign a user to the drawer.
5. Record a pay-in ($1.00, memo).
6. Record a pay-out ($1.00, memo).
7. Record a cash drop / safe drop / deposit if applicable.
8. Refresh / reload the drawer activity list.
9. Close the drawer (note variance).
10. View the closed drawer's detail page if applicable.

Same scratchpad rules apply.

## Step 4 — Save the captures

1. In the DevTools **Network** tab, right-click any row → **Save all as
   HAR with content**. Save as `cash-management-{YYYY-MM-DD}.har`.

2. *(If you ran the console instrumentation:)*
   In the **Console** panel, run:

   ```js
   window.__flowhubInstrument.summary()
   ```

   This prints a table of how many times each operation fired. Use it as
   a sanity check — there should be at least one entry per action you
   performed.

   Then run:

   ```js
   window.__flowhubInstrument.dump()
   ```

   This triggers a download of a redacted JSON file
   (`flowhub-instrument-<timestamp>.json`).

3. Send both files (the `.har` and the instrumentation `.json`) back here,
   along with your scratchpad notes mapping actions to rough timestamps
   and amounts.

## Step 5 — What I'll do with the captures

When the files arrive, I'll:

1. Run [`scripts/extract-graphql-from-har.mjs`](../scripts/extract-graphql-from-har.mjs)
   over the HAR to pull out only the Flowhub GraphQL POSTs, with
   credentials redacted.
2. Cross-reference against your scratchpad notes + the instrumentation
   dump to attribute each operation to a user action.
3. Append a `## Capture results` section to the bottom of this doc with,
   for each action: operation name, variables shape, response shape, and
   any quirks (e.g. operations that fire twice, polling queries that take
   a since-cursor variable, etc).
4. **Then** — informed by what we actually captured plus the existing
   patterns in `src/dashboard/reports.ts` and `src/resources/` — design
   the resource API shape and propose it before implementing.
5. Build out `src/dashboard/cash-management.ts` + types + tests, mirroring
   the reports module's structure.

## Security notes on what you're sharing

**The HAR contains your live session token.** The `Authorization` header
in every captured request is your dashboard session ID (a UUID, not a
JWT). It's valid for ~4 hours from the Login moment in the capture. Anyone
who gets the raw HAR within that window can impersonate you against the
dashboard until the token expires.

In practice:

- Sharing the HAR in this session is fine — the channel is private.
- Don't post the raw HAR in a public issue, gist, screenshot, or PR.
- After we're done with the capture, **log out of the dashboard** to
  invalidate the captured token immediately.

**The instrumentation JSON dump is safer.** It redacts the `password`
variable on the Login mutation and the entire `login` response block
(which contains the access token and refresh token). It doesn't include
request headers at all. If you need to share something less sensitive,
share that instead — though the HAR has more detail and is what the
extractor script consumes.

**The repo already ignores `*.har`** via `.gitignore`, so accidentally
committing a captured HAR is not possible without going out of your way.
