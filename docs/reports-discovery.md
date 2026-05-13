# Flowhub Dashboard Reports — Discovery Findings

> Status: **complete** — captured from HAR files on 2026-05-11.

## Base URL

`https://api.flowhub.com`

## Login

**Endpoint:** `POST /graph/query` (GraphQL, same endpoint as everything else)

**Request body:**
```json
{
  "operationName": "Login",
  "variables": { "email": "...", "password": "..." },
  "query": "mutation Login($email: String!, $password: String!) { login(email: $email, password: $password) { id refreshId expireTime user { ... } } }"
}
```

The exact GraphQL query string is very long because the dashboard requests the full user, store, role, and permissions tree on login. For our purposes we only need a minimal version returning `{ id, refreshId, expireTime }`.

**Response:**
```json
{
  "data": {
    "login": {
      "id": "1d8fdb56-eef7-442d-affe-cc951b6aef04",
      "refreshId": "c004833a-b3f0-482e-9b7f-6c614490074b",
      "expireTime": 1778575722,
      "user": { /* huge tree we don't need */ }
    }
  }
}
```

- `id` — access token (UUID, not JWT)
- `refreshId` — refresh token (UUID)
- `expireTime` — Unix epoch seconds; ~4-hour lifetime observed (login at 00:48:42 → expire at 04:48:42)

## Authentication

Subsequent requests use `Authorization: Bearer <id>` header. Confirmed via CORS preflight:

```
access-control-request-headers: authorization,traceparent
```

(Chrome strips `Authorization` header values from HAR exports, but the preflight reveals the header is in use.)

## Reports list

Available reports come from `POST /analytics/query` with operation `GetReports`. Returns ~60 reports across these categories:

- `finance_accounting` — accounting, end-of-day, tax-activity
- `sales_revenue` — sales-day-store, category-sales, employee-sales, sold-items, etc.
- `customers` — customers, customers-activity, gift-cards
- `marketing_promotions_loyalty` — customers-loyalty, deals-usage, loyalty-transactions
- `staff_operations` — transactions, deliveries, drawers, shifts, transfers
- `inventory` — inventory, inventory-snapshot, inventory-levels, par-level, etc.
- `compliance` — new-york-sales, new-york-inventory, regulatory-reported-sales-failures

Each report has metadata: `reportId`, `name`, `reportTypeInfo.type`, `parameters[]` (each with `key`, `type`, `isRequired`).

Full list of `reportId`s captured: accounting, budtender-performance, category-sales, category-sales-daily, customers, customers-activity, customers-loyalty, customers-sales-performance, deals-full-details, deals-usage, deliveries, drawers-new, drawers-activity, employee-sales, end-of-day, gift-cards, inventory, inventory-activity, inventory-creation, inventory-discrepancy-activity, inventory-forensics, inventory-levels, inventory-snapshot, loyalty-changes, loyalty-transactions, new-york-inventory, new-york-sales, par-level, predictive-par-level, product-activity, product-catalog, product-catalog-full-details, product-performance, product-sales-performance, roles-activity, sales-customer-group, sales-day-store, sales-variant, regulatory-reported-sales-failures, shifts, sold-gift-cards, sold-items, tax-activity, tips-by-budtender, tips-by-hour, transaction-activities, transaction-adjustments, transactions, transfers, transfers-invoices, upsells-by-budtender, users-activity.

(A few reports use UUID `reportId`s — these appear to be custom/shared reports specific to this account.)

## CSV download

**Endpoint:** `GET /analytics/<reportId>?<params>`

**Common params:**
- `start_date` — required, date format (e.g., `2026-05-11`)
- `end_date` — required, date format
- `store_id` — UUID, scopes to a specific store

**Report-specific params** vary; for example:
- `budtender-performance` adds `brand`, `product_name`, `employee`, `category`, `purchase_type`, `order_type`
- `category-sales` adds `purchase_type`, `order_type`, `brand`

**Request headers:**
- `Authorization: Bearer <token>`
- `Accept: application/octet-stream`

**Response:**
- `Content-Type: text/plain; charset=utf-8` (mislabeled — body is CSV)
- `Content-Disposition` header was **not** observed — we'll need to construct filenames ourselves
- Body is comma-separated values

Example (truncated):
```
,Total,05/11/2026
NY Local Cannabis Tax (Approx. 4%) (REC),$342.22,$342.22
NY Sales Tax (Approx. 8.875%) (Accessories),$2.41,$2.41
NY State Cannabis Tax (Approx. 9%) (REC),$769.72,$769.72
Total Tax in Dollars,"$1,114.35","$1,114.35"
...
```

## Token lifetime

~4 hours based on observed `expireTime` delta. The dashboard appears to use the `refreshId` to mint a new token — actual refresh endpoint not yet observed (we never saw an expiry in the captured session). Safe assumption: there's a `refresh` GraphQL operation; if not observable, we can just re-login on 401.

## Per-location scoping

Reports use `store_id` query param. Multiple stores per user are listed in the login response under `user.stores[]`. `activeStoreId` in the response indicates the default.

## Other observations

- GraphQL is used at `/graph/query`, `/billing/query`, `/analytics/query`
- REST CSV downloads only at `/analytics/<reportId>`
- No CSRF token, no custom headers required
- Standard Bearer token auth, no cookies
