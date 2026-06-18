# Captures drop folder

**Drop reverse-engineering captures here** — HAR files or redacted
`instrument-flowhub.js` JSON dumps — and I'll work through them to build the
matching internal resources.

> ⚠️ **Everything in this folder is git-ignored** (except this README). HARs
> contain a **live dashboard session token** (~4h). They are never committed.
> After capturing, **log out** of the dashboard to invalidate the token, and
> prefer the redacted instrument JSON when you can (it strips the password +
> login token). See any `docs/*-discovery.md` runbook for the capture steps.

## How to drop files

- **In the web/app chat:** just attach the files to a message. I'll read them
  and move each into this folder as I process it. (Naming still helps — see
  below.)
- **If you have workspace file access:** copy them straight into `captures/`.

## Naming convention (so I can map each file → issue)

Use these names (`.har` or `.json` for the instrument dump):

| File | Issue | Screen captured |
|---|---|---|
| `products.har` | [#7](https://github.com/yerba-buena/flowhub-client-ts/issues/7) | Inventory → Products: list, open detail, **edit→save**, **new**, copy, delete |
| `inventory-batch.har` | [#8](https://github.com/yerba-buena/flowhub-client-ts/issues/8) | Inventory → Inventory: list/filter, view details, **edit→save**, new (⚠️ non-prod store — Metrc ledger) |
| `inventory-log.har` | [#6](https://github.com/yerba-buena/flowhub-client-ts/issues/6) | Inventory → Log: filter to one SKU + date range; click a row; Download CSV |
| `deals.har` | [#9](https://github.com/yerba-buena/flowhub-client-ts/issues/9) | Deals: list, open a deal, **edit→save**, **new** (Product / Buy & Get / Bundle), activate/inactivate — on an inactive test deal |

If you split a capture per action, suffix it (`products-edit.har`,
`products-create.har`, …) — I'll group them by prefix.

The key thing for the **write** features (#7/#8/#9) is that the form is actually
**saved** during capture, so the create/update mutation fires. Edit→Cancel
captures only the read query.

## Full runbooks

- **Products / Inventory / Log (#6, #7, #8):** [`docs/product-inventory-discovery.md`](../docs/product-inventory-discovery.md)
- **Deals (#9):** [`docs/deals-discovery.md`](../docs/deals-discovery.md)
