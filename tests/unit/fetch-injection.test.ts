import { describe, expect, it, vi } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubInternalClient } from "../../src/internal/client.js";

function jsonResponse(body: unknown, status = 200) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

describe("custom fetch injection (SSRF hook)", () => {
	it("FlowhubClient routes API requests through the injected fetchFn", async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
		const client = new FlowhubClient({
			clientId: "cid",
			apiKey: "key",
			baseUrl: "https://api.test.com",
			fetchFn,
		});

		await client.locations.list();

		expect(fetchFn).toHaveBeenCalledTimes(1);
		const url = fetchFn.mock.calls[0]![0] as string;
		expect(url).toContain("https://api.test.com");
	});

	it("FlowhubClient routes Auth0 token requests through the injected fetchFn", async () => {
		const fetchFn = vi
			.fn()
			.mockResolvedValue(jsonResponse({ access_token: "tok", token_type: "Bearer" }));
		const client = new FlowhubClient({ clientId: "cid", apiKey: "key", fetchFn });

		await client.authToken.getToken({
			grant_type: "client_credentials",
			client_id: "cid",
			client_secret: "secret",
			audience: "https://api.flowhub.co",
		});

		expect(fetchFn).toHaveBeenCalledTimes(1);
		const url = fetchFn.mock.calls[0]![0] as string;
		expect(url).toContain("flowhub.auth0.com");
	});

	it("forLocation() preserves the injected fetchFn", async () => {
		const fetchFn = vi.fn().mockResolvedValue(jsonResponse({ data: [] }));
		const client = new FlowhubClient({
			clientId: "cid",
			apiKey: "key",
			baseUrl: "https://api.test.com",
			fetchFn,
		}).forLocation("loc-1");

		await client.inventory.list();

		expect(fetchFn).toHaveBeenCalledTimes(1);
		const url = fetchFn.mock.calls[0]![0] as string;
		expect(url).toContain("/loc-1/");
	});

	it("FlowhubInternalClient routes requests through the injected fetchFn", async () => {
		const nowSeconds = Math.floor(Date.now() / 1000);
		const fetchFn = vi.fn().mockResolvedValue(
			jsonResponse({
				data: { login: { id: "tok-1", refreshId: "r-1", expireTime: nowSeconds + 3600 } },
			}),
		);
		const client = new FlowhubInternalClient({
			email: "user@example.com",
			password: "pw",
			baseUrl: "https://api.flowhub.com",
			fetchFn,
		});

		// Any authenticated call triggers a login through the injected fetch.
		await client.users.list().catch(() => {
			/* login succeeds via mock; downstream shape is irrelevant here */
		});

		expect(fetchFn).toHaveBeenCalled();
		const url = fetchFn.mock.calls[0]![0] as string;
		expect(url).toContain("https://api.flowhub.com");
	});

	it("falls back to globalThis.fetch when no fetchFn is provided", () => {
		// Construction must not throw and must not eagerly call fetch.
		const spy = vi.spyOn(globalThis, "fetch");
		new FlowhubClient({ clientId: "cid", apiKey: "key" });
		expect(spy).not.toHaveBeenCalled();
		spy.mockRestore();
	});
});
