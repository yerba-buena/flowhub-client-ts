---
"@yerba-buena/flowhub-client": minor
---

Add `reports.downloadReportRows()` and a zero-dependency CSV parser.

`internal.reports.downloadReportRows(reportId, params)` downloads any report and parses its CSV into `{ columns, rows }`, where each row is an object keyed by the column headers (raw string values). This lets consumers work with report data programmatically instead of handling raw bytes — useful immediately for the Sales Performance app's per-budtender metrics while typed per-report helpers are still being built (#13).

The CSV parser (`parseCsv` / `parseCsvRaw`, exported from `/internal`) is RFC 4180-ish — it handles quoted fields, embedded commas/newlines, escaped quotes, and CRLF — and adds no runtime dependencies. Also documents in `reports-discovery.md` which reports carry a per-seller dimension (`budtender-performance`, `employee-sales`, `upsells-by-budtender`, `tips-by-budtender`, loyalty/customers).
