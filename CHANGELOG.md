# Changelog

All notable changes to this project will be documented in this file.

## 0.0.1 (Unreleased)

### Added

- `FlowhubClient` with credential management and `forLocation()` scoping
- HTTP layer with retry, backoff, and timeouts
- Typed error hierarchy: `FlowhubAuthError`, `FlowhubRateLimitError`, `FlowhubNotFoundError`, `FlowhubValidationError`
- **Locations** resource — `list()`
- **Inventory** resource — `list()`, `listNonZero()`, `listAnalytics()`, `listByLocation()`, per-location scoping
- **Orders** resource — `getCustomers()`, `getCustomerById()`, `getCustomerByPhone()`, `createCustomer()`, `updateCustomer()`, `listByCustomerId()`, `listByLocationId()`
- **Order Ahead** resource — `create()`, `update()`, `postback()`, `getStatus()`, `testAuth()`, `health()`
- **Auth Token** resource — `create()`
- Full contract test suite (77 tests) with MSW
- Integration tests for Locations, Inventory, Orders, and Order Ahead (gated on env vars)
- **Dashboard module** (`@yerba-buena/flowhub-client/dashboard`) — `FlowhubDashboardClient` for downloading CSV reports from the Flowhub dashboard via reverse-engineered internal endpoints. Uses email/password to mint a session token; supports ~60 report types (`accounting`, `sales-day-store`, `inventory-snapshot`, etc.). Token caching, lazy login, 5-minute refresh margin, 401 retry-once behavior, per-store scoping via `forStore()`.
