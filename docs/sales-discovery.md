# Flowhub Sales — Discovery Findings

> Status: **complete (read path)** — captured from a HAR of the dashboard
> Cashier → Sales screen on 2026-06-17 (list, single-sale inspect, date-range
> search). Implemented as the `sales` resource on `FlowhubInternalClient`.

## Why

The internal Sales screen exposes richer per-sale data than the public API and,
critically, the **seller's user UUID** — which closes the `email → seller`
mapping that issue #10 needed.

## Endpoint & auth

Same internal surface as the rest: `POST https://api.flowhub.com/graph/query`,
bare-UUID `Authorization`, `Origin: https://app.flowhub.com`, dashboard creds.

## Operation

A single GraphQL op, `GetSales`, backs both list and single-lookup via the
`filteredSales` field — only the params differ (same pattern as
`filteredUsers`):

```graphql
# list
filteredSales(salesParams: {
  startDate, endDate, limit, offset, drawerIds, employeeIds, reportingStatus,
  customerType, paymentMethod, source, orderBy, orderDirection,
  shouldIncludeAllStores, search
}) { ...SaleFields }

# single sale
filteredSales(salesParams: { id: $id }) { ...SaleFields }
```

- Pagination is **limit/offset** (dashboard uses `limit: 20`, `orderBy: "completedAt"`,
  `orderDirection: "desc"`). `listAll()` paginates until a short page.
- `startDate`/`endDate` (`YYYY-MM-DD`) are required for the list.
- **`employeeIds: [ID]`** filters to specific sellers — purpose-built for a
  per-budtender Sales Performance view.
- **Money is integer cents** (`totalPrice: 1200` = $12.00).

### Sale shape (selected subset)

The dashboard's `SaleFields` fragment is large (full customer PII, transactions,
regulatory reports, delivery, …). We select only a roster/performance-relevant
subset:

```
id, source, receiptId, storeId, storeName, purchaseType ("REC"|"MED"),
completedAt (ISO 8601), editedCount,
soldBy { id, meta }            # meta is a JSON scalar { firstName, lastName }
drawer { id, name }
totalPreTaxPrice, totalPostTaxPrice, totalItemPrice,
totalDiscounts, totalTaxes, totalFees, totalPrice,   # all cents
loyalty { pointsEarned, pointsSpent },
items [{ id, inventoryId, categoryId, brand, productName, variantName, sku,
         regulatoryId, isSoldByWeight, quantity,
         preTaxPrice, postTaxPrice, totalItemCost, totalPrice,
         totalDiscounts, totalTaxes }]
```

The resource adds a derived `itemCount` (sum of `items[].quantity`, i.e. UPT).
**Deliberately not selected:** the `customer` block (PII), `transactions`,
`regulatoryStatus` (contains employee emails), `delivery`, `refundedItems`.

## ✅ ID verification (resolves #10's open criterion)

This capture **confirms** `employee.id == Sale seller id`. A user UUID that
appeared as an `employees` (`filteredUsers`) `id` in the earlier roster capture
appears **verbatim** as a `Sale.soldBy.id` here, for the same person (matched by
name). So:

```ts
const sale = (await internal.sales.list({ startDate, endDate }))[0];
const seller = await internal.employees.get(sale.soldBy!.id); // -> email
```

The public API's `Sale.budtenderId` is the same seller-identity field (typed as
`string` in `flowhub-api-docs`); the only remaining check, if you read sales from
the **public** API rather than this internal one, is a one-off confirmation that
a public `budtenderId` equals a known `employees` id — but the internal path is
proven.

## Not captured

- Sale **writes** (refunds/edits) — read-only screen actions only.
- The full `customer` / `transactions` / `delivery` detail — intentionally out of
  scope for the performance/roster use case; can be added to the selection later
  if needed.
