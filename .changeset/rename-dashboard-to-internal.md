---
"@yerba-buena/flowhub-client": minor
---

Rename the `dashboard` surface to `internal`.

The reverse-engineered, non-public-API surface was misnamed: "dashboard" implied it only covered one screen, but it actually covers everything reachable outside Flowhub's public API by reverse-engineering the web interface (CSV reports, cash management, and more to come). It's now exported from `@yerba-buena/flowhub-client/internal` as `FlowhubInternalClient`.

This is a safe, source-compatible transition — nothing breaks yet:

- New: `import { FlowhubInternalClient } from "@yerba-buena/flowhub-client/internal"`
- The old `@yerba-buena/flowhub-client/dashboard` entry point is kept as a deprecated alias that re-exports the new surface under the old names (`FlowhubDashboardClient`, `FlowhubDashboardClientConfig`, `DEFAULT_DASHBOARD_BASE_URL`). It still works but is marked `@deprecated` and will be removed in a future release.

Renamed symbols:

- `FlowhubDashboardClient` → `FlowhubInternalClient`
- `FlowhubDashboardClientConfig` → `FlowhubInternalClientConfig`
- `DEFAULT_DASHBOARD_BASE_URL` → `DEFAULT_INTERNAL_BASE_URL`

The `FLOWHUB_DASHBOARD_*` env-var convention used by the examples and integration tests is now `FLOWHUB_INTERNAL_*` (the legacy names are still accepted by the test suite as a fallback). All resources, types, the `DrawerWatcher`, error classes, and runtime behavior are unchanged.
