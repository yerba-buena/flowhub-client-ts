# Flowhub Deals — Discovery Capture Runbook

> Status: **awaiting capture**. Runbook for reverse-engineering the Deals
> (discounts/promotions) operations from the Flowhub dashboard. Send me the
> resulting HAR + console dump and I'll extract the operations, append findings
> here, and design the resource API — same workflow as
> [`cash-management-discovery.md`](./cash-management-discovery.md).

## Issue this serves

- **[#9 — Programmatic deal creation and editing](https://github.com/yerba-buena/flowhub-client-ts/issues/9)**
  — the **Deals** app: list deals (Name / Type / Amount / Status / Start / End /
  Promo Code), and create/edit a deal (Cart Subtotal Discount, Product Discount,
  Buy & Get, Bundle), with limits (order type / store / customer group) and a
  Save-As-Active / Save-As-Inactive status toggle.

## Background

There is **no deals endpoint in the public Flowhub API at all** — a code search
of the [`flowhub-api-docs`](https://github.com/yerba-buena/flowhub-api-docs)
mirror for "deals" returns zero results. The Deals app at `app.flowhub.com`
performs everything via GraphQL against `https://api.flowhub.com/graph/query`
(same endpoint, same `SessionAuth` UUID token / `Origin` header as `reports`
and `cash-management`).

### What already works today (interim, read-only)

The internal `reports` resource already exposes deals data after the fact:

| Need | Method today |
|---|---|
| Configured deals + their settings | `internal.reports.downloadDealsFullDetails({ start_date, end_date, store_id })` |
| Deal redemptions / usage | `internal.reports.downloadDealsUsage({ … })` |

These are read-only CSVs. This capture is about the **live list query** and the
**create/update/activate mutations** the reports can't provide.

## Pre-flight checklist

- Use a **non-production store** if you can; otherwise create a clearly-named
  **test deal** (e.g. `ZZZ-TEST-DEAL`) and save it **Inactive** so it never
  affects real carts.
- Keep changes small and reversible; delete the test deal when done.
- Use **Chrome**. **Log out fully** before starting so Login is captured.
- Keep a **scratchpad** of each action + rough timestamp + values entered.

## Step 1 — Open DevTools and start recording

1. DevTools → **Network**; check **Preserve log** + **Disable cache**; filter to
   **Fetch/XHR**; record; 🚫 clear.

## Step 2 — Console instrumentation (optional but recommended)

Paste [`scripts/instrument-flowhub.js`](../scripts/instrument-flowhub.js) into
the Console. Use `summary()` / `dump()` / `reset()` as described in the cash
management runbook.

## Step 3 — Perform the actions

One HAR per action (recommended) or one combined HAR. 🚫 clear between actions.

**D1 — Navigate to Deals list** (`d1-deals-list-YYYY-MM-DD.har`)
1. Open the **Deals** app. Wait for the table to render. Toggle the **Status**
   and **Discount type** filters once.
   → captures the list query + filter/pagination variables and the row shape
   (name, type, amount, status, start, end, promo code, store scope).

**D2 — Open a deal's detail/edit** (`d2-deal-edit-open-YYYY-MM-DD.har`)
1. Click an existing **test/inactive** deal to open its edit view.
   → captures the single-deal fetch (or confirms it reuses the list payload).

**D3 — Edit a deal** (`d3-deal-edit-save-YYYY-MM-DD.har`)
1. On a **test deal**, change one obvious field (e.g. the discount Amount, or a
   Deal Limitation), then **Save As Inactive**.
2. **Scratchpad:** field, old → new. → captures the update mutation + full
   variable shape, including how the deal **type** (Cart Subtotal / Product /
   Buy & Get / Bundle) and the limitation selectors are represented.

**D4 — Create a deal** (`d4-deal-create-YYYY-MM-DD.har`)
1. **New Deal** → pick a type (start with **Product Discount**, the simplest) →
   fill required fields with obvious test values → **Save As Inactive**.
2. **Scratchpad:** type + values. → captures the create mutation.
3. *(Optional)* repeat for **Buy & Get** and **Bundle** as separate HARs
   (`d4b-…`, `d4c-…`) — their payload shapes likely differ and we'll want all of
   them to model the type union correctly.

**D5 — Toggle status active/inactive** (`d5-deal-activate-YYYY-MM-DD.har`)
1. On the test deal, use **Save As Active** then **Save As Inactive** (or the
   list's status control if there is one).
2. → captures whether status is a field on the update mutation or a separate
   activate/deactivate op. **Immediately re-save Inactive** so the test deal is
   left disabled.

**D6 — Delete the test deal** (`d6-deal-delete-YYYY-MM-DD.har`) — if available
1. Delete the throwaway test deal → confirm. **Scratchpad:** which deal.

## Step 4 — Save and send

1. **Save all as HAR with content** (per filenames, or one combined
   `deals-YYYY-MM-DD.har`).
2. If instrumented: `summary()` sanity check, then `dump()` for the redacted JSON.
3. Send the `.har` (+ instrumentation `.json`) and scratchpad notes.

## Step 5 — What I'll do with the captures

1. Run [`scripts/extract-graphql-from-har.mjs`](../scripts/extract-graphql-from-har.mjs)
   to pull out the Flowhub GraphQL POSTs, credentials redacted.
2. Attribute each operation to an action via your notes + the instrumentation dump.
3. Append a `## Capture results` section: per action, operation name, variables
   shape, response shape, and quirks (especially the deal-type discriminated
   union and the active/inactive mechanism).
4. Propose a `deals` resource API (list / get / create / update / setStatus /
   delete) mirroring the existing internal resources — **before** implementing.
5. Build it with types + MSW unit tests; gate any write-path live tests behind
   the `FLOWHUB_LIVE_TEST` env flags used by cash management.

## Security notes on what you're sharing

**The HAR contains your live session token** (the `Authorization` UUID, valid
~4 hours). Never post a raw HAR in a public issue, gist, screenshot, or PR;
**log out** after capturing to invalidate it. The repo `.gitignore`s `*.har`.
The instrumentation JSON is the safer thing to share (login password + response
redacted, no request headers).
