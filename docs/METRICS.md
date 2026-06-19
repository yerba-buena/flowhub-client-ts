# Computing per-budtender sales metrics (AOV / UPT / loyalty)

A guide to computing common per-seller metrics correctly with this client —
which fields to read, what to include/exclude, and the data-semantics gotchas
that cause silent "everything is zero" bugs. Written for the Sales Performance
use case (per-budtender weekly AOV, UPT, loyalty signups, loyalty %).

> **Legend:** ✅ confirmed · ⚠️ gotcha · ❓ needs live verification (tracked in
> [#18](https://github.com/yerba-buena/flowhub-client-ts/issues/18) /
> [#13](https://github.com/yerba-buena/flowhub-client-ts/issues/13)).

## 0. Pick the right source — and the right seller key ⚠️

There are two ways to read sales, and **they don't share a proven seller-id
join**:

| Source | Seller field | Join to `employees.id`? |
|---|---|---|
| **Internal** `internal.sales` (`filteredSales`) | `soldBy.id` | ✅ **verified equal** to `employees.id` (#10/#12) |
| **Public** `flowhub.orders.listByLocationId` | `Sale.budtenderId` | ❓ **unverified** — optional, observed **absent/empty** in production, possibly a different id namespace |

**Recommendation:** for per-budtender metrics, use **`internal.sales`** and join
on **`soldBy.id`**. Joining `public Sale.budtenderId === employee.id` has
produced all-zero leaderboards with no error, because `budtenderId` is not
guaranteed present and its namespace isn't confirmed. (`budtenderId` is now typed
`string | undefined` so a missing value surfaces at compile time instead of
silently failing a join.)

```ts
// roster: email -> employee id (verified == soldBy.id)
const roster = await internal.employees.listAll({ status: "all" });
const byId = new Map(roster.map((e) => [e.id, e]));

// one budtender's week of sales, joined reliably
const sales = await internal.sales.listAll({
  startDate: "2026-06-01", endDate: "2026-06-07", // YYYY-MM-DD, store-local
  employeeIds: [budtenderId],
});
```

## 1. AOV — average order value

Average of each sale's total over the qualifying sales.

- **Field:** `internal.sales` → `totalPrice` (post-tax grand total, **integer
  cents**) or `totalPreTaxPrice` (pre-tax). Public → `totals.FinalTotal` /
  `totals.SubTotal`. Decide **pre-tax vs post-tax** explicitly — they differ by
  taxes+fees. ✅
- **Exclude:** voided sales (`voided === true` on public; internal sales are
  completed sales). ✅ Decide whether to exclude `$0` comps/gift-card-only orders
  — typically yes for a "performance" AOV. ⚠️
- `AOV = sum(totalPrice of kept sales) / count(kept sales)`. Cents → divide by
  100 only at display time.

## 2. UPT — units per transaction

- **Units:** sum of `items[].quantity` (internal) / `itemsInCart[].quantity`
  (public) per sale. The internal `Sale` exposes a derived **`itemCount`** =
  Σ`quantity`. ✅
- `UPT = sum(itemCount) / count(transactions)`.
- ❓ **Verify** how returns/refunds and `$0` comp lines appear: are refunded
  units negative quantities, a separate refund sale, or `refundedItems`? Public
  refunds carry `originalSaleId`. Confirm against live data before trusting UPT
  on days with returns.

## 3. Loyalty % (attach rate)

Share of transactions attached to a loyalty member.

- **Today, from `internal.sales`:** each sale has `loyalty { pointsEarned,
  pointsSpent }`. `pointsEarned > 0 || pointsSpent > 0` is a **proxy** for "loyalty
  member transacted." ⚠️ It's a proxy, not a membership flag.
- **Authoritative:** join the sale's `customerId` to a customer and check
  `Customer.isLoyal`. The **internal** `sales` resource deliberately omits the
  customer block, so this needs either the public `orders`/`customers` path or
  the loyalty reports (#13).
- `loyalty% = loyalty-attached transactions / total transactions`.

## 4. Loyalty signups (new enrollments in a window)

- ❓ **Not cleanly derivable from sales alone today.** You need each customer's
  **enrolled/created date** and membership: `Customer.isLoyal` +
  `Customer.createdAt` within the window is the closest proxy, but `createdAt` is
  customer-record creation, **not** necessarily loyalty-enrollment time.
- The intended path is the **loyalty/customers reports** (`customers-loyalty` /
  `loyalty-transactions` / `customers`) — blocked on capturing their columns
  (#13). Until typed helpers land, use `internal.reports.downloadReportRows(...)`
  to read those CSVs directly.

## 5. Order status casing ⚠️

Live public orders return **lowercase** `orderStatus` (e.g. `"sold"`), even
though Flowhub's docs example shows `"Sold"`. The type is permissive; **compare
case-insensitively**:

```ts
const isSold = (o: Sale) => o.orderStatus.toLowerCase() === "sold";
```

## 6. Time semantics ⚠️

- **`completedOn`** = when the sale completed → use this for "sales in period".
  **`createdAt`** = order creation (≈ completion for retail, not identical).
- The `created_after` / `created_before` list filters key on **creation date in
  the store's local timezone** (not UTC) and require **`YYYY-MM-DD`**. When
  building a UTC week window, account for the store's offset — an order at
  `2026-06-13T02:00Z` is `2026-06-12` for an ET store. See the README "Rate
  limiting" section.

## Open verifications

These affect metric correctness and are tracked for live confirmation:

- ❓ Public `Sale.budtenderId` presence + whether it equals `employees.id` — [#18 item 2](https://github.com/yerba-buena/flowhub-client-ts/issues/18). **Until confirmed, use `internal.sales.soldBy.id`.**
- ❓ Refund/return representation in UPT.
- ❓ Loyalty enrollment timestamp + report columns — [#13](https://github.com/yerba-buena/flowhub-client-ts/issues/13).
