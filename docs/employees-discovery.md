# Flowhub Employees / Staff — Discovery Findings

> Status: **complete (read path)** — captured from a HAR of the dashboard
> Employees screen on 2026-06-16 (navigation, pagination, edit→cancel, shifts,
> roles, new-user). Implemented as the `employees` resource on
> `FlowhubInternalClient`. Serves
> [#10](https://github.com/yerba-buena/flowhub-client-ts/issues/10).

## Why

A Sales Performance app authenticates budtenders by **email** (via YBAM), but
Flowhub `Sale` records identify the seller only by `budtenderId` + a `budtender`
display name — no email. There is no staff endpoint in the public API (confirmed
against `flowhub-api-docs`). The dashboard's Employees screen, however, lists
the full roster with id + email, giving a deterministic `email → id` bridge.

## Endpoint & auth

Same as the rest of the internal surface: `POST https://api.flowhub.com/graph/query`,
`Authorization: <session-uuid>` (no `Bearer`), `Origin: https://app.flowhub.com`.
Dashboard credentials (email + password), not a public API key.

## Operations observed

The Employees screen fired these GraphQL ops (counts from the capture):

| Operation | Count | Role | Wrapped? |
|---|---|---|---|
| `GetAllUsers` | 7 | Paginated roster list | **Yes** → `employees.list` / `listAll` |
| `GetOneUser` | 2 | Single employee (edit/detail) | **Yes** → `employees.get` |
| `GetRoles` / `GetRolesIdsAndNames` / `GetPermissions` | 4 / 1 / 1 | Roles & permissions admin | Not yet — out of scope for #10 |
| `GetAllShifts` | 1 | Shifts tab | Not yet |
| `OwnUserStores` / `OwnUserStoreSettings` / `FeatureFlag` | 1 / 3 / 3 | Session/store bootstrap | N/A |

**No write mutations were captured.** The "Edit" and "New User" clicks opened
forms but were cancelled / not saved, so create/update/deactivate shapes are
still unknown. The `email → id` mapping is read-only, so this doesn't block #10.

## The roster query

Both list and single-lookup use the same `filteredUsers` field — only the
params differ:

```graphql
# list (GetAllUsers)
filteredUsers(usersParams: {
  storeId, search, status, roleId, limit, offset, orderBy, orderDirection
}) { ...CoreUserFields }

# single (GetOneUser)
filteredUsers(usersParams: { userId: $id, status: all }) { ...CoreUserFields }
```

- Pagination is **limit/offset** (the dashboard uses `limit: 20`). No total-count
  field is selected, so `listAll()` paginates until it sees a short page.
- `status` is a `UserStatus` enum; observed value `active`, and `all` is used by
  `GetOneUser`. Default in our `list()` is `active`.
- `orderBy` is a `UsersOrderBy` enum; `orderDirection` is `asc`/`desc`.

### User shape (selected fields)

The dashboard requests a huge `CoreUserFields` fragment. We select only the
roster-relevant subset:

```
id            UUID — expected to equal Sale.budtenderId
email         the YBAM bridge
phoneNumber   string | null
status        "active" | ...
isInternal    boolean
activeStoreId UUID | null
meta          JSON scalar: { firstName, lastName }   ← selected bare, not sub-selected
roleId        UUID
role          { id, name }            (full fragment also has permissions, etc.)
stores        [{ id, name }]          (full fragment has address/settings/rooms/...)
```

**Deliberately excluded:** the fragment also returns
`apiKeys { key, state, username, password }` and `files` — secrets / irrelevant
to a roster. We don't select them, so they never hit the wire response or our
types.

## Open verification (acceptance criterion)

`Employee.id == Sale.budtenderId` is assumed from Flowhub's data model but was
**not** verifiable from this HAR (it contains no `Sale` records). Spot-check once:
pull a recent `Sale`, take its `budtenderId`, and confirm
`employees.get(budtenderId)` returns the expected person. Documented inline on
`Employee.id`.

## Mapping to the resource

`src/internal/employees.ts` + `employees-types.ts`:

- `list(params)` — one page; defaults `status: "active"`, applies the client's
  default `storeId`.
- `listAll(params)` — auto-paginates (page size 100) into the full roster; ideal
  for building an `email → employee` index.
- `get(id)` — single employee by UUID (or `null`).
- `Employee` adds derived `name` (`"First Last"`) and `active`
  (`status === "active"`), plus `storeIds` from `stores[].id`.

## Not yet captured (future work)

- **Write path** (create / edit / deactivate employee) — needs a capture where
  the Edit/New-User form is actually **saved**. Would back an `employees.create`
  / `update` API.
- **Roles & permissions** (`GetRoles` / `GetPermissions`) and **shifts**
  (`GetAllShifts`) — separate resources if/when needed.
