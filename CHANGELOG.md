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
- Full contract test suite (72 tests) with MSW
- Integration tests for Locations and Inventory (gated on env vars)
