import { describe, expect, it, vi } from "vitest";
import {
	FlowhubAuthError,
	FlowhubError,
	FlowhubNotFoundError,
	FlowhubRateLimitError,
} from "../../src/errors.js";
import { HttpClient } from "../../src/http.js";

function mockResponse(status: number, body: unknown, headers: Record<string, string> = {}) {
	return new Response(JSON.stringify(body), {
		status,
		statusText: `Status ${status}`,
		headers: { "content-type": "application/json", ...headers },
	});
}

function textResponse(status: number, body: string, headers: Record<string, string> = {}) {
	return new Response(body, {
		status,
		statusText: `Status ${status}`,
		headers,
	});
}

function createClient(
	fetchFn: typeof fetch,
	overrides: { retries?: number; timeout?: number } = {},
) {
	return new HttpClient({
		credentials: { clientId: "test-client", apiKey: "test-key" },
		baseUrl: "https://api.test.com",
		fetchFn,
		retries: overrides.retries ?? 0,
		timeout: overrides.timeout,
	});
}

describe("HttpClient", () => {
	describe("successful requests", () => {
		it("returns parsed JSON on 200", async () => {
			const fetchFn = vi.fn().mockResolvedValue(mockResponse(200, { data: "ok" }));
			const client = createClient(fetchFn);
			const result = await client.request<{ data: string }>({ path: "/test" });
			expect(result).toEqual({ data: "ok" });
		});

		it("sends auth headers on every request", async () => {
			const fetchFn = vi.fn().mockResolvedValue(mockResponse(200, {}));
			const client = createClient(fetchFn);
			await client.request({ path: "/test" });
			const [, init] = fetchFn.mock.calls[0]!;
			expect(init.headers.clientId).toBe("test-client");
			expect(init.headers.key).toBe("test-key");
		});

		it("appends query params to URL", async () => {
			const fetchFn = vi.fn().mockResolvedValue(mockResponse(200, {}));
			const client = createClient(fetchFn);
			await client.request({ path: "/test", query: { limit: 10, active: true } });
			const url = fetchFn.mock.calls[0]![0] as string;
			expect(url).toContain("limit=10");
			expect(url).toContain("active=true");
		});

		it("skips undefined query params", async () => {
			const fetchFn = vi.fn().mockResolvedValue(mockResponse(200, {}));
			const client = createClient(fetchFn);
			await client.request({ path: "/test", query: { a: "yes", b: undefined } });
			const url = fetchFn.mock.calls[0]![0] as string;
			expect(url).toContain("a=yes");
			expect(url).not.toContain("b=");
		});
	});

	describe("error mapping", () => {
		it("throws FlowhubAuthError on 401 without retrying", async () => {
			const fetchFn = vi.fn().mockResolvedValue(textResponse(401, "Unauthorized"));
			const client = createClient(fetchFn, { retries: 3 });
			await expect(client.request({ path: "/test" })).rejects.toThrow(FlowhubAuthError);
			expect(fetchFn).toHaveBeenCalledTimes(1);
		});

		it("throws FlowhubNotFoundError on 404 without retrying", async () => {
			const fetchFn = vi.fn().mockResolvedValue(textResponse(404, "Not Found"));
			const client = createClient(fetchFn, { retries: 3 });
			await expect(client.request({ path: "/test" })).rejects.toThrow(FlowhubNotFoundError);
			expect(fetchFn).toHaveBeenCalledTimes(1);
		});
	});

	describe("retry behavior", () => {
		it("retries on 500 up to retries count", async () => {
			const fetchFn = vi.fn().mockResolvedValue(textResponse(500, "Server Error"));
			const client = createClient(fetchFn, { retries: 2 });

			await expect(client.request({ path: "/test" })).rejects.toThrow(FlowhubError);
			expect(fetchFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
		});

		it("retries on 429 and throws FlowhubRateLimitError", async () => {
			const fetchFn = vi.fn().mockResolvedValue(textResponse(429, "Too Many Requests"));
			const client = createClient(fetchFn, { retries: 1 });

			await expect(client.request({ path: "/test" })).rejects.toThrow(FlowhubRateLimitError);
			expect(fetchFn).toHaveBeenCalledTimes(2);
		});

		it("retries on network error then succeeds", async () => {
			const fetchFn = vi
				.fn()
				.mockRejectedValueOnce(new TypeError("fetch failed"))
				.mockResolvedValueOnce(mockResponse(200, { ok: true }));
			const client = createClient(fetchFn, { retries: 1 });

			const result = await client.request<{ ok: boolean }>({ path: "/test" });
			expect(result).toEqual({ ok: true });
			expect(fetchFn).toHaveBeenCalledTimes(2);
		});

		it("returns success after transient 500", async () => {
			const fetchFn = vi
				.fn()
				.mockResolvedValueOnce(textResponse(500, "fail"))
				.mockResolvedValueOnce(mockResponse(200, { recovered: true }));
			const client = createClient(fetchFn, { retries: 1 });

			const result = await client.request<{ recovered: boolean }>({ path: "/test" });
			expect(result).toEqual({ recovered: true });
		});
	});
});
