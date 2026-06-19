---
"@yerba-buena/flowhub-client": minor
---

Make the public order seller-identity field honest, fix `orderStatus` typing, and add a sales-metrics guide (resolves #19).

**Type fixes (public `Sale`):**
- `budtender` and `budtenderId` are now `string | undefined` — the public API marks them not-required and they've been observed **absent in production**. This surfaces a missing seller id at compile time instead of silently failing a `budtenderId === employeeId` join (which produced all-zero metrics with no error).
- `orderStatus` is now a permissive union including the **lowercase** values live data actually returns (`"sold"`, …) alongside the doc's TitleCase. The JSDoc says to compare case-insensitively.
- Added field docs clarifying `createdAt` vs `completedOn`, `voided`, and `SaleTotals.FinalTotal` (post-tax) vs `SubTotal` (pre-tax) for AOV.

**New guide — `docs/METRICS.md`:** how to compute AOV / UPT / loyalty % / loyalty signups correctly, what to include/exclude, the order-status casing and store-local-timezone gotchas, and — most importantly — **the seller-id join**: the verified key is the internal `sales` resource's `soldBy.id` (== `employees.id`), not the public `budtenderId` (unverified / sometimes absent). Linked from the README.
