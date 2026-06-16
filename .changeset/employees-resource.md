---
"@yerba-buena/flowhub-client": minor
---

Add an `employees` resource to `FlowhubInternalClient` for the staff roster.

Exposes the deterministic **`email → id`** mapping needed to bridge external identity (e.g. YBAM email) to the `budtenderId` carried on Flowhub `Sale` records:

- `employees.list(params)` — one page of employees (defaults to `active`, applies the client's default `storeId`; supports `search`, `status`, `roleId`, `limit`/`offset`, `orderBy`/`orderDirection`).
- `employees.listAll(params)` — the whole roster, auto-paginated; ideal for building an `email → employee` index.
- `employees.get(id)` — a single employee by user UUID.

`Employee` exposes `id` (expected to equal `Sale.budtenderId`), `name`, `firstName`/`lastName`, `email`, `phoneNumber`, `status`/`active`, `isInternal`, `activeStoreId`, `role`, and `storeIds`/`stores`. Backed by the dashboard's internal `filteredUsers` GraphQL field (reverse-engineered — see `docs/employees-discovery.md`); the dashboard's `apiKeys` secrets block is deliberately not selected or surfaced. Read-only; requires dashboard credentials, not a public API key.
