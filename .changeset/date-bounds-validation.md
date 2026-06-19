---
"@yerba-buena/flowhub-client": patch
---

Document and validate the `YYYY-MM-DD` date bounds on order/customer list endpoints.

A downstream live probe confirmed that `created_after` / `created_before` (and `updated_after` / `updated_before`) **are** honored server-side by Flowhub's list endpoints — a week-bounded fetch is ~98% smaller than full history — but only as `YYYY-MM-DD`; a full ISO timestamp is rejected with `404 …must be in format yyyy-mm-dd`. The client now validates these params and throws `FlowhubValidationError` with a clear message before sending, instead of surfacing a confusing 404.

Docs updated to record the format requirement plus the timezone behavior: the bound is applied in the **store's local time** (not UTC) and keys on the order's **creation** date. The README's rate-limit section also notes that Flowhub has been observed to send no rate-limit headers, so the client-side throttle + jittered backoff is the effective mechanism.
