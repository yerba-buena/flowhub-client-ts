import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubAuthError } from "../../src/errors.js";
import { LOCATIONS_LIST_RESPONSE, LOCATION_DENVER } from "../fixtures/locations.fixtures.js";

const BASE_URL = "https://api.test.flowhub.co";

const server = setupServer(
	http.get(`${BASE_URL}/v0/clientsLocations`, ({ request }) => {
		const clientId = request.headers.get("clientId");
		const key = request.headers.get("key");

		if (!clientId || !key) {
			return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		return HttpResponse.json(LOCATIONS_LIST_RESPONSE);
	}),
);

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

describe("LocationsResource", () => {
	describe("list", () => {
		it("sends GET to /v0/clientsLocations with auth headers", async () => {
			const client = createClient();
			const result = await client.locations.list();

			expect(result.status).toBe(200);
			expect(result.data).toHaveLength(2);
		});

		it("returns typed Location objects", async () => {
			const client = createClient();
			const result = await client.locations.list();
			const loc = result.data[0]!;

			expect(loc.locationId).toBe(LOCATION_DENVER.locationId);
			expect(loc.locationName).toBe("Headquarters");
			expect(loc.address.city).toBe("Denver");
			expect(loc.licenseType).toEqual(["rec", "med"]);
		});

		it("sends query params for pagination", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/clientsLocations`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(LOCATIONS_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			await client.locations.list({ limit: 10, offset: 20 });

			expect(capturedUrl).toContain("limit=10");
			expect(capturedUrl).toContain("offset=20");
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

	describe("iterate", () => {
		it("yields all locations from a single page", async () => {
			const client = createClient();
			const locations = [];
			for await (const loc of client.locations.iterate()) {
				locations.push(loc);
			}

			expect(locations).toHaveLength(2);
			expect(locations[0]!.locationName).toBe("Headquarters");
			expect(locations[1]!.locationName).toBe("Boston Branch");
		});
	});
});
