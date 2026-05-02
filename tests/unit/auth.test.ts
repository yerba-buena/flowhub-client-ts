import { describe, expect, it } from "vitest";
import { createAuthHeaders, redactCredentials } from "../../src/auth.js";

describe("createAuthHeaders", () => {
	it("returns clientId and key headers", () => {
		const headers = createAuthHeaders({
			clientId: "4b6d4b59-304a-420e-a14c-09018e4c4d44",
			apiKey: "secret-key-uuid",
		});
		expect(headers).toEqual({
			clientId: "4b6d4b59-304a-420e-a14c-09018e4c4d44",
			key: "secret-key-uuid",
		});
	});

	it("returns Bearer auth header when accessToken is provided", () => {
		const headers = createAuthHeaders({
			clientId: "test",
			apiKey: "test",
			accessToken: "my-token",
		});
		expect(headers).toEqual({ Authorization: "Bearer my-token" });
	});
});

describe("redactCredentials", () => {
	it("truncates clientId and redacts apiKey", () => {
		const redacted = redactCredentials({
			clientId: "4b6d4b59-304a-420e-a14c-09018e4c4d44",
			apiKey: "secret-key-uuid",
		});
		expect(redacted.clientId).toBe("4b6d4b59...");
		expect(redacted.apiKey).toBe("***REDACTED***");
	});

	it("never exposes the full apiKey", () => {
		const key = "my-super-secret-api-key";
		const redacted = redactCredentials({ clientId: "test", apiKey: key });
		expect(redacted.apiKey).not.toContain(key);
	});
});
