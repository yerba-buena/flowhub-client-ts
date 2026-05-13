import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DashboardHttp } from "../../src/dashboard/http.js";
import { SessionAuth } from "../../src/dashboard/session-auth.js";
import { FlowhubAuthError } from "../../src/errors.js";

const DASHBOARD_URL = "https://api.flowhub.com";

function makeLoginResponse(
	overrides: Partial<{ id: string; refreshId: string; expireTime: number }> = {},
) {
	const nowSeconds = Math.floor(Date.now() / 1000);
	return {
		data: {
			login: {
				id: overrides.id ?? "token-abc",
				refreshId: overrides.refreshId ?? "refresh-xyz",
				expireTime: overrides.expireTime ?? nowSeconds + 4 * 60 * 60,
			},
		},
	};
}

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => {
	server.resetHandlers();
	vi.useRealTimers();
});
afterAll(() => server.close());

function makeAuth(credentials = { email: "user@example.com", password: "secret" }) {
	const httpClient = new DashboardHttp({ baseUrl: DASHBOARD_URL, timeout: 5000 });
	return new SessionAuth(credentials, httpClient);
}

describe("SessionAuth", () => {
	it("logs in lazily and returns the access token", async () => {
		let capturedBody: Record<string, unknown> | undefined;
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json(makeLoginResponse({ id: "first-token" }));
			}),
		);

		const auth = makeAuth({ email: "alice@example.com", password: "pw" });
		const token = await auth.getToken();

		expect(token).toBe("first-token");
		expect(capturedBody?.operationName).toBe("Login");
		const variables = capturedBody?.variables as Record<string, string>;
		expect(variables.email).toBe("alice@example.com");
		expect(variables.password).toBe("pw");
	});

	it("reuses the cached token across sequential getToken() calls", async () => {
		let loginCount = 0;
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, () => {
				loginCount++;
				return HttpResponse.json(makeLoginResponse({ id: "cached-token" }));
			}),
		);

		const auth = makeAuth();
		const first = await auth.getToken();
		const second = await auth.getToken();
		const third = await auth.getToken();

		expect(first).toBe("cached-token");
		expect(second).toBe("cached-token");
		expect(third).toBe("cached-token");
		expect(loginCount).toBe(1);
	});

	it("concurrent getToken() calls share a single login request", async () => {
		let loginCount = 0;
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, async () => {
				loginCount++;
				await new Promise((r) => setTimeout(r, 30));
				return HttpResponse.json(makeLoginResponse({ id: "shared-token" }));
			}),
		);

		const auth = makeAuth();
		const tokens = await Promise.all([
			auth.getToken(),
			auth.getToken(),
			auth.getToken(),
			auth.getToken(),
			auth.getToken(),
		]);

		expect(tokens).toEqual([
			"shared-token",
			"shared-token",
			"shared-token",
			"shared-token",
			"shared-token",
		]);
		expect(loginCount).toBe(1);
	});

	it("refreshes the token when within 5 minutes of expiry", async () => {
		const nowSeconds = Math.floor(Date.now() / 1000);
		let loginCount = 0;
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, () => {
				loginCount++;
				const expireTime = loginCount === 1 ? nowSeconds + 60 : nowSeconds + 4 * 60 * 60;
				return HttpResponse.json(makeLoginResponse({ id: `token-${loginCount}`, expireTime }));
			}),
		);

		const auth = makeAuth();
		const first = await auth.getToken();
		const second = await auth.getToken();

		expect(first).toBe("token-1");
		expect(second).toBe("token-2");
		expect(loginCount).toBe(2);
	});

	it("invalidate() forces re-login on the next getToken()", async () => {
		let loginCount = 0;
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, () => {
				loginCount++;
				return HttpResponse.json(makeLoginResponse({ id: `token-${loginCount}` }));
			}),
		);

		const auth = makeAuth();
		const first = await auth.getToken();
		auth.invalidate();
		const second = await auth.getToken();

		expect(first).toBe("token-1");
		expect(second).toBe("token-2");
		expect(loginCount).toBe(2);
	});

	it("throws FlowhubAuthError on failed login without exposing credentials", async () => {
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, () => {
				return HttpResponse.json(
					{ errors: [{ message: "Invalid email or password" }] },
					{ status: 200 },
				);
			}),
		);

		const auth = makeAuth({ email: "user@example.com", password: "secret-pw" });
		let caught: unknown;
		try {
			await auth.getToken();
		} catch (err) {
			caught = err;
		}

		expect(caught).toBeInstanceOf(FlowhubAuthError);
		const err = caught as Error;
		expect(err.message).not.toContain("secret-pw");
		expect(err.message).not.toContain("user@example.com");
	});

	it("throws FlowhubAuthError on HTTP 401 from server", async () => {
		server.use(
			http.post(`${DASHBOARD_URL}/graph/query`, () => {
				return new HttpResponse("Unauthorized", { status: 401 });
			}),
		);

		const auth = makeAuth();
		await expect(auth.getToken()).rejects.toThrow(FlowhubAuthError);
	});
});
