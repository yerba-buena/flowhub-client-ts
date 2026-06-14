---
"@yerba-buena/flowhub-client": minor
---

Add internal `reports` convenience methods for inventory-activity and deals reports.

`FlowhubInternalClient.reports` gains `downloadInventoryActivity`, `downloadProductActivity`, `downloadDealsUsage`, and `downloadDealsFullDetails` — thin typed wrappers over the existing `downloadReport()` for the `inventory-activity`, `product-activity`, `deals-usage`, and `deals-full-details` report IDs.

These provide an interim, read-only path for the inventory-log (#6) and deals (#9) feature requests while the live, structured/write operations are reverse-engineered (capture runbooks added under `docs/`).
