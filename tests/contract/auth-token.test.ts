import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { AuthTokenResource } from "../../src/resources/auth-token.js";

const AUTH0_URL = "https://flowhub.auth0.com";

const server = setupServer(
	http.post(`${AUTH0_URL}/oauth/token`, async ({ request }) => {
		const body = (await request.json()) as Record<string, unknown>;

		if (body.client_id !== "valid-client" || body.client_secret !== "valid-secret") {
			return HttpResponse.json(
				{
					error: "access_denied",
					error_description: "Unauthorized",
				},
				{ status: 401 },
			);
		}

		return HttpResponse.json({
			access_token: "eyJhbGciOi...",
			scope: "create:orders read:orders",
			expires_in: 86400,
			token_type: "Bearer",
		});
	}),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe("AuthTokenResource", () => {
	it("POST /oauth/token sends client credentials and returns access token", async () => {
		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.post(`${AUTH0_URL}/oauth/token`, async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({
					access_token: "test-token-123",
					scope: "create:orders",
					expires_in: 3600,
					token_type: "Bearer",
				});
			}),
		);

		const resource = new AuthTokenResource();
		const result = await resource.getToken({
			client_id: "valid-client",
			client_secret: "valid-secret",
			audience: "https://api.flowhub.co",
			grant_type: "client_credentials",
		});

		expect(capturedBody.client_id).toBe("valid-client");
		expect(capturedBody.client_secret).toBe("valid-secret");
		expect(capturedBody.audience).toBe("https://api.flowhub.co");
		expect(capturedBody.grant_type).toBe("client_credentials");

		expect(result.access_token).toBe("test-token-123");
		expect(result.scope).toBe("create:orders");
		expect(result.expires_in).toBe(3600);
		expect(result.token_type).toBe("Bearer");
	});

	it("throws on invalid credentials (401)", async () => {
		const resource = new AuthTokenResource();
		await expect(
			resource.getToken({
				client_id: "bad-client",
				client_secret: "bad-secret",
				audience: "https://api.flowhub.co",
				grant_type: "client_credentials",
			}),
		).rejects.toThrow("OAuth token request failed (401)");
	});
});
