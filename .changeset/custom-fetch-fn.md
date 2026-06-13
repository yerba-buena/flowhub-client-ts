---
"@yerba-buena/flowhub-client": minor
---

Expose a `fetchFn` option on `FlowhubClient` and `FlowhubInternalClient` for SSRF-safe egress and other outbound-request customization.

`fetchFn` is a custom `fetch` implementation used for **all** outbound requests (the main API, the internal endpoints, and the Auth0 token endpoint). It defaults to `globalThis.fetch`, so existing code is unaffected.

This is the supported extension point for consumers who need to control the connection layer — most notably to defend against **SSRF via DNS rebinding** when the `baseUrl` is (even partly) user-influenced. By passing a `fetch` wired to an `undici` `Agent` with a pinned `connect.lookup`, consumers can resolve-validate-and-pin the destination IP and close the rebinding window at the library boundary, instead of forking or routing through an egress proxy. The same seam works for injecting proxies, request instrumentation, or test stubs.

`fetchFn` is a seam, not a guarantee: the library does not validate destinations itself; it hands control of the connection layer to the consumer. See the README's "Custom fetch / SSRF hardening" section for a pinned-lookup recipe.

Resolves #3.
