---
"@yerba-buena/flowhub-client": minor
---

Add `FlowhubDashboardClient` for downloading CSV reports from the Flowhub dashboard

A new subpath export `@yerba-buena/flowhub-client/dashboard` exposes a client for downloading CSV reports (accounting, sales, inventory snapshots, transactions, etc.) that are only available through the Flowhub web dashboard, not the public API. Authenticates with email + password to mint a session token (with 5-minute refresh margin and concurrent-safe caching), retries once on 401. Supports ~60 report types via a generic `downloadReport(reportId, params)` method plus typed convenience wrappers for the most common ones.

Uses reverse-engineered internal endpoints — see `src/dashboard/README.md` for security posture and stability caveats.
