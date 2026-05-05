import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubAuthError } from "../../src/errors.js";
import { INVENTORY_FLOWER, INVENTORY_LIST_RESPONSE } from "../fixtures/inventory.fixtures.js";

const BASE_URL = "https://api.test.flowhub.co";

const server = setupServer(
	http.get(`${BASE_URL}/v0/inventory`, ({ request }) => {
		const clientId = request.headers.get("clientId");
		const key = request.headers.get("key");

		if (!clientId || !key) {
			return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		return HttpResponse.json(INVENTORY_LIST_RESPONSE);
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

describe("InventoryResource", () => {
	describe("list", () => {
		it("sends GET to /v0/inventory with auth headers", async () => {
			const client = createClient();
			const result = await client.inventory.list();

			expect(result.status).toBe(200);
			expect(result.data).toHaveLength(2);
		});

		it("returns typed InventoryItem objects", async () => {
			const client = createClient();
			const result = await client.inventory.list();
			const item = result.data[0]!;

			expect(item.productId).toBe(INVENTORY_FLOWER.productId);
			expect(item.productName).toBe("Afghani Shake - One Gram");
			expect(item.category).toBe("Flower");
			expect(item.cannabinoidInformation).toHaveLength(4);
			expect(item.cannabinoidInformation[2]!.name).toBe("thc");
			expect(item.terpenes).toHaveLength(1);
			expect(item.terpenes[0]!.name).toBe("Limonene");
			expect(item.purchaseCategory).toBe("rec");
			expect(item.variantId).toBe(INVENTORY_FLOWER.variantId);
		});

		it("sends query params for pagination", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventory`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			await client.inventory.list({ limit: 10, offset: 20 });

			expect(capturedUrl).toContain("limit=10");
			expect(capturedUrl).toContain("offset=20");
		});

		it("sends locationId query param when provided", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventory`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			await client.inventory.list({ locationId: "loc-123" });

			expect(capturedUrl).toContain("locationId=loc-123");
		});
	});

	describe("error handling", () => {
		it("throws FlowhubAuthError on 401", async () => {
			server.use(
				http.get(`${BASE_URL}/v0/inventory`, () => {
					return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
				}),
			);

			const client = createClient();
			await expect(client.inventory.list()).rejects.toThrow(FlowhubAuthError);
		});
	});

	describe("listNonZero", () => {
		it("sends GET to /v0/inventoryNonZero", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventoryNonZero`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listNonZero();

			expect(result.status).toBe(200);
			expect(result.data).toHaveLength(2);
			expect(capturedUrl).toContain("/v0/inventoryNonZero");
		});
	});

	describe("listByLocation", () => {
		it("sends GET to /v0/locations/{locationId}/inventory with locationId in path", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/inventory`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listByLocation(locationId);

			expect(result.status).toBe(200);
			expect(result.data).toHaveLength(2);
			expect(capturedUrl).toContain(`/v0/locations/${locationId}/inventory`);
		});
	});

	describe("listAnalytics", () => {
		it("sends includesNotForSaleQuantity query param", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventoryAnalytics`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			await client.inventory.listAnalytics({ includesNotForSaleQuantity: true });

			expect(capturedUrl).toContain("includesNotForSaleQuantity=true");
		});

		it("omits includesNotForSaleQuantity when not provided", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventoryAnalytics`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			await client.inventory.listAnalytics();

			expect(capturedUrl).not.toContain("includesNotForSaleQuantity");
		});
	});

	describe("iterate", () => {
		it("yields all inventory items from a single page", async () => {
			const client = createClient();
			const items = [];
			for await (const item of client.inventory.iterate()) {
				items.push(item);
			}

			expect(items).toHaveLength(2);
			expect(items[0]!.productName).toBe("Afghani Shake - One Gram");
			expect(items[1]!.productName).toBe("Chewy Gummies 100mg");
		});
	});

	describe("forLocation scoping", () => {
		it("routes list() to /v0/locations/{locationId}/inventory", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/inventory`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			const scoped = client.forLocation(locationId);
			const result = await scoped.inventory.list();

			expect(result.status).toBe(200);
			expect(capturedUrl).toContain(`/v0/locations/${locationId}/inventory`);
		});
	});
});
