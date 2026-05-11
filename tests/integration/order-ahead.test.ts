import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

try {
	const envPath = resolve(import.meta.dirname, "../../.env");
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1]!.trim()] = match[2]!.trim();
	}
} catch {}

// Order Ahead uses separate Auth0 OAuth2 credentials (not the regular API key pair).
// The audience is fixed per the Access Token API spec.
const SKIP =
	!process.env.FLOWHUB_ORDER_AHEAD_CLIENT_ID || !process.env.FLOWHUB_ORDER_AHEAD_CLIENT_SECRET;
const AUTH0_AUDIENCE = "https://api.flowhub.co";

describe.skipIf(SKIP)("Order Ahead integration", () => {
	it("obtains an OAuth2 access token and creates an authenticated client", async () => {
		const tempClient = new FlowhubClient({
			clientId: process.env.FLOWHUB_CLIENT_ID ?? "",
			apiKey: process.env.FLOWHUB_API_KEY ?? "",
		});

		const tokenResponse = await tempClient.authToken.getToken({
			client_id: process.env.FLOWHUB_ORDER_AHEAD_CLIENT_ID!,
			client_secret: process.env.FLOWHUB_ORDER_AHEAD_CLIENT_SECRET!,
			audience: AUTH0_AUDIENCE,
			grant_type: "client_credentials",
		});

		expect(tokenResponse).toHaveProperty("access_token");
		expect(typeof tokenResponse.access_token).toBe("string");
		expect(tokenResponse.access_token.length).toBeGreaterThan(0);
		expect(tokenResponse).toHaveProperty("token_type");
		expect(tokenResponse.token_type).toBe("Bearer");
		expect(typeof tokenResponse.expires_in).toBe("number");
		expect(tokenResponse.expires_in).toBeGreaterThan(0);

		// Verify the token can be used to construct a client
		const client = new FlowhubClient({
			clientId: process.env.FLOWHUB_CLIENT_ID ?? "",
			apiKey: process.env.FLOWHUB_API_KEY ?? "",
			accessToken: tokenResponse.access_token,
		});
		expect(client.orderAhead).toBeDefined();
	});

	// Note: /authTest and /health are marked x-private in the spec and return
	// 404 on the public API gateway. Only the token exchange and order CRUD
	// endpoints are publicly accessible.
});
