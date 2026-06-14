# Flowhub Products & Inventory — Discovery Capture Runbook

> Status: **awaiting capture**. This document is a runbook for you to follow in
> the Flowhub dashboard so we can reverse-engineer the product-catalog,
> inventory/batch, and inventory-log operations. Once you send me the resulting
> HAR + console dump, I'll extract the operations, append findings to this doc,
> and design the resource API — exactly the workflow we used for
> [`cash-management-discovery.md`](./cash-management-discovery.md).

## Issues this serves

- **[#6 — Inventory log](https://github.com/yerba-buena/flowhub-client-ts/issues/6)**
  — the per-SKU audit trail under Inventory → **Log** (Action / Date / RegId·SKU
  / Δ / Pkg Total / Inv Total / Employee).
- **[#7 — Product editing](https://github.com/yerba-buena/flowhub-client-ts/issues/7)**
  — Inventory → **Products** create / edit / copy / delete.
- **[#8 — Inventory / batch editing](https://github.com/yerba-buena/flowhub-client-ts/issues/8)**
  — Inventory → **Inventory** create / edit a physical package (quantity,
  batch number, Metrc regulatory ID, batch-specific pricing, MED/REC, on-hold).

All three live in the same **Inventory** app at `app.flowhub.com` and talk to
the same GraphQL endpoint, so they can be captured in one sitting.

## Background

Flowhub's **public** API is read-mostly. Confirmed against the
[`flowhub-api-docs`](https://github.com/yerba-buena/flowhub-api-docs) mirror:

- Products: a read-only schema (`05-products.md`); no create/update/delete.
- Inventory: read-only (`06-inventory.md`, inventory / non-zero / analytics /
  by-room); no quantity or batch editing.
- The only public write surface is **orders** (`PatchOrder` + order ingest).

So everything in this runbook is **dashboard-only** — performed by
`app.flowhub.com` via GraphQL against `https://api.flowhub.com/graph/query`
(the same endpoint the existing `reports` and `cash-management` modules use,
authenticated with the same `SessionAuth` UUID token, no `Bearer` prefix,
`Origin: https://app.flowhub.com`).

### What already works today (interim, read-only)

You do **not** need this capture to get after-the-fact data — the internal
`reports` resource already exposes the relevant CSVs:

| Need | Method today |
|---|---|
| Inventory movement / audit log (#6) | `internal.reports.downloadInventoryActivity({ start_date, end_date, store_id })` |
| Product-catalog change history (#6/#7) | `internal.reports.downloadProductActivity({ … })` |
| Inventory snapshot / levels (#8 context) | `internal.reports.downloadInventorySnapshot` / `downloadInventoryLevels` |
| Full product catalog | `internal.reports.downloadReport("product-catalog-full-details", { … })` |

The capture below is about the **live, structured, and write** operations the
reports can't give you: a filterable per-SKU log, and creating/editing products
and inventory packages.

## Pre-flight checklist

- Use a **non-production store** if you possibly can. Product edits and —
  especially — inventory/batch edits **post to a real Metrc/compliance ledger**.
  Inventory #8 is the highest-risk capture in this repo; treat it accordingly.
- Make only **small, reversible** changes (rename a test product back to its
  original; adjust a test package's quantity by ±1 and put it back).
- Prefer a **dedicated test product** and a **single test package** you create
  for this purpose, so cleanup is a delete rather than an edit-back.
- Use **Chrome** (Edge / Brave fine). The extractor was built against Chrome HARs.
- **Log out fully** before starting so the Login mutation is captured in the
  same recording.
- Keep a **scratchpad**: jot each action + rough timestamp + what you changed,
  so we can map captured operations to actions.

## Step 1 — Open DevTools and start recording

1. Open DevTools (`Ctrl+Shift+I` / `Cmd+Opt+I`) → **Network** tab.
2. Check **Preserve log** and **Disable cache**.
3. Set the request filter to **Fetch/XHR**.
4. Click record (red), then 🚫 clear so the log starts empty.

## Step 2 — Install the console instrumentation (optional but recommended)

Paste the contents of
[`scripts/instrument-flowhub.js`](../scripts/instrument-flowhub.js) into the
Console and hit Enter. It logs every Flowhub GraphQL operation (name, variables,
response) as it fires and can `dump()` a redacted JSON file that's smaller and
safer to share than a full HAR. `summary()` prints operation counts;
`reset()` clears between actions.

## Step 3 — Perform the actions

Capture **one HAR per action** (recommended — easier to attribute, smaller
files) or one combined HAR. Between actions: 🚫 clear the Network log, perform
the action, save the HAR with the filename below, and note it on your scratchpad.
If an action doesn't exist in your dashboard, skip it and note "N/A".

### Products (#7)

**P1 — Navigate to Products list** (`p1-products-list-YYYY-MM-DD.har`)
1. Go to Inventory → **Products**. Wait for the table to render.
   → captures the list/query op + its pagination/filter variables.

**P2 — Open a product's detail panel** (`p2-product-detail-YYYY-MM-DD.har`)
1. Click a product row so the right-hand **Details** panel opens.
   → captures the single-product fetch (note whether it's a separate op or
   already in the list payload). Also click the **Activity** tab if present.

**P3 — Edit a product** (`p3-product-edit-YYYY-MM-DD.har`)
1. With a **test product** selected, click **Edit**.
2. Change one easy-to-spot field (e.g. External Display Name → `ZZZ-TEST-EDIT`).
3. **Save**. → captures the update mutation + full variable shape.
4. **Scratchpad:** which field, old value, new value.

**P4 — Create a product** (`p4-product-create-YYYY-MM-DD.har`)
1. Click **New Product**, fill the minimum required fields with obvious test
   values, **Save**. → captures the create mutation.
2. (If you used the **Import From Catalog** path, capture that separately as
   `p4b-product-import-YYYY-MM-DD.har` — it may be a different op.)

**P5 — Copy a product** (`p5-product-copy-YYYY-MM-DD.har`) — optional
1. Select the test product → **Copy**. → captures the duplicate op.

**P6 — Delete a product** (`p6-product-delete-YYYY-MM-DD.har`)
1. Select a throwaway test product → **Delete** → confirm.
2. **Scratchpad:** which product.

### Inventory / batches (#8)

> Highest-risk section — keep amounts tiny and reverse every change.

**I1 — Navigate to Inventory list** (`i1-inventory-list-YYYY-MM-DD.har`)
1. Go to Inventory → **Inventory**. Wait for the package table to render.
   → captures the list/query op. Open **More Filters** and toggle one filter
   (e.g. Zero Qty) so we capture how filters are passed.

**I2 — View a package's details** (`i2-inventory-detail-YYYY-MM-DD.har`)
1. Click **View Details** on a package. → captures the single-package fetch.

**I3 — Edit a package** (`i3-inventory-edit-YYYY-MM-DD.har`)
1. On a **test package**, change one field (e.g. Batch-Specific *Out The Door
   Price*, or the On-Hold toggle) and **Save**.
2. **Scratchpad:** field, old → new. → captures the update mutation, including
   how `quantity`, `batchNumber`, `regulatoryId`/Metrc, pricing, and MED/REC are
   represented.

**I4 — Create inventory** (`i4-inventory-create-YYYY-MM-DD.har`) — optional, only on a non-prod store
1. **New Inventory**, link it to a test product, enter a tiny quantity, **Save**.
2. **Scratchpad:** quantity, batch number.

### Inventory log (#6)

**L1 — Open the Log for a single SKU** (`l1-inventory-log-YYYY-MM-DD.har`)
1. Go to Inventory → **Log**.
2. Search/filter to **one SKU** and set a **date range**.
3. Wait for the rows to render. → captures the log query + how it's filtered by
   SKU and date, and the row shape (action, delta, pkg total, inv total,
   employee).
4. Click a row if it opens a detail pane ("Select an item to view details").
5. Click **Download CSV** once so we can compare the REST CSV path to the
   GraphQL row shape. **Scratchpad:** the SKU and date range you used.

## Step 4 — Save and send

1. Network tab → right-click any row → **Save all as HAR with content** (per the
   filenames above, or one combined `product-inventory-YYYY-MM-DD.har`).
2. If you ran the instrumentation: `window.__flowhubInstrument.summary()` as a
   sanity check, then `window.__flowhubInstrument.dump()` to download the
   redacted JSON.
3. Send the `.har` (and the instrumentation `.json`) plus your scratchpad notes.

## Step 5 — What I'll do with the captures

1. Run [`scripts/extract-graphql-from-har.mjs`](../scripts/extract-graphql-from-har.mjs)
   to pull out only the Flowhub GraphQL POSTs, credentials redacted.
2. Cross-reference against your scratchpad + instrumentation dump to attribute
   each operation to an action.
3. Append a `## Capture results` section here: per action, the operation name,
   variables shape, response shape, and quirks.
4. Propose the resource API shape (a `products` resource, an `inventory`
   write/log resource) — mirroring `src/internal/reports.ts` and
   `cash-management.ts` — **before** implementing.
5. Build it out with types + MSW unit tests, and gate any write-path live tests
   behind the same `FLOWHUB_LIVE_TEST` env flags used by cash management.

## Security notes on what you're sharing

**The HAR contains your live session token** (the `Authorization` UUID, valid
~4 hours from the Login in the capture). Anyone with the raw HAR in that window
can act as you against the dashboard. So:

- Sharing the HAR in this private session is fine.
- **Never** post a raw HAR in a public issue, gist, screenshot, or PR.
- **Log out** after capturing to invalidate the token immediately.
- The repo already `.gitignore`s `*.har`, so committing one by accident isn't possible without going out of your way.

The instrumentation JSON is safer (it redacts the login password and the
`login` response block, and omits request headers) — prefer it if you want to
share something less sensitive, though the HAR has more detail.
