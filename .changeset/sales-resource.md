---
"@yerba-buena/flowhub-client": minor
---

Add a `sales` resource to `FlowhubInternalClient`, and verify the employee `id` ↔ sale seller id mapping.

`internal.sales` reads completed sales from the dashboard's internal `filteredSales` field — distinct from the public orders/sales API in that it carries `soldBy { id }` (the seller's user UUID, **equal to the `employees` resource `id`** and the public API's `Sale.budtenderId`) and accepts an `employeeIds` filter, making it purpose-built for per-budtender Sales Performance views.

- `sales.list(params)` — one page within a required `startDate`/`endDate`, with `employeeIds`/`drawerIds`/`customerType`/`search`/pagination filters.
- `sales.listAll(params)` — the full range, auto-paginated.
- `sales.get(id)` — a single sale.

`Sale` exposes `soldBy`, `drawer`, integer-cents totals, `loyalty`, `items`, and a derived `itemCount` (UPT); customer PII and transaction detail are deliberately not selected. Read-only; requires dashboard credentials.

This capture also **confirms** issue #10's open acceptance criterion: a user UUID seen as an `employees` `id` appears verbatim as a `Sale.soldBy.id`, so `employees.get(sale.soldBy.id)` deterministically resolves a seller's email.
