---
"@yerba-buena/flowhub-client": minor
---

Fix internal GraphQL queries that 422 against Flowhub's live schema (resolves #23).

Validated against real dashboard captures, several internal queries were malformed and failed with `GRAPHQL_VALIDATION_FAILED`:

- **`users.list()` (#23)** — was hitting a non-existent `users(...)` field with `String`-typed variables and over-selected `meta`. Rewritten to the real `filteredUsers(usersParams: {...})` shape: `$storeId: ID`, `$status: UserStatus`, `$orderBy: UsersOrderBy`; `meta` selected as a scalar; `role.permissions` selected as objects (`{ id, name, action, target }`). This unblocks reading the real `User.role` + permissions. **Type change:** `UserRole.permissions` is now `UserPermission[]` (objects), not `string[]`, and `UserRole.isHourly?` was added; new `UserPermission` type exported.
- **`drawers.list()` / `DrawerWatcher` (`GetDrawers`)** — found by auditing the HAR vs. the client. Same class of bug: `$id: String`/`$orderBy: String`/`$orderDirection: String` (now `ID`/`DrawersOrderBy`/`OrderDirection`), `meta { firstName lastName }` over-selection (now scalar), and `payins`/`payouts`/`drops`/`pops` were sub-selected though they are scalars (now selected bare). The shared `DrawerFields` fragment fix also corrects the return selections of the drawer mutations.

Adds non-hollow regression tests that assert the corrected query shapes for both operations.
