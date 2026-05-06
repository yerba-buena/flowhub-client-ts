import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubAuthError } from "../../src/errors.js";
import { LOCATIONS_LIST_RESPONSE } from "../fixtures/locations.fixtures.js";

const BASE_URL = "https://api.test.flowhub.co";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient() {
	return new FlowhubClient({
		clientId: "test-client-id",
		apiKey: "test-api-key",
		baseUrl: BASE_URL,
		retries: 0,
	});
}

interface CapturedRequest {
	url: string;
	clientId: string;
	key: string;
}

function captureLocations(captured: CapturedRequest[] = []): CapturedRequest[] {
	server.use(
		http.get(`${BASE_URL}/v0/clientsLocations`, ({ request }) => {
			captured.push({
				url: request.url,
				clientId: request.headers.get("clientId") ?? "",
				key: request.headers.get("key") ?? "",
			});
			return HttpResponse.json(LOCATIONS_LIST_RESPONSE);
		}),
	);
	return captured;
}

describe("LocationsResource", () => {
	describe("list", () => {
		it("sends GET /v0/clientsLocations with clientId and key headers", async () => {
			const reqs = captureLocations();

			const client = createClient();
			await client.locations.list();

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v0/clientsLocations");
			expect(reqs[0]!.clientId).toBe("test-client-id");
			expect(reqs[0]!.key).toBe("test-api-key");
		});

		it("returns { status, data } envelope from server response", async () => {
			captureLocations();

			const client = createClient();
			const result = await client.locations.list();

			expect(result).toHaveProperty("status");
			expect(result).toHaveProperty("data");
			expect(typeof result.status).toBe("number");
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data).toHaveLength(2);
		});
	});

	describe("error handling", () => {
		it("throws FlowhubAuthError on 401", async () => {
			server.use(
				http.get(`${BASE_URL}/v0/clientsLocations`, () => {
					return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
				}),
			);

			const client = createClient();
			await expect(client.locations.list()).rejects.toThrow(FlowhubAuthError);
		});
	});
});
