import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubAuthError } from "../../src/errors.js";
import {
	INVENTORY_ANALYTICS_BY_ROOM_RESPONSE,
	INVENTORY_ANALYTICS_FLOWER,
	INVENTORY_ANALYTICS_RESPONSE,
	INVENTORY_BY_ROOM_FLOWER,
	INVENTORY_BY_ROOM_RESPONSE,
	INVENTORY_FLOWER,
	INVENTORY_LIST_RESPONSE,
} from "../fixtures/inventory.fixtures.js";

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
	// ── list() ──────────────────────────────────────────────────────
	describe("list", () => {
		it("sends GET to /v0/inventory with auth headers", async () => {
			const client = createClient();
			const result = await client.inventory.list();

			expect(result.status).toBe(200);
			expect(result.data).toHaveLength(2);
		});

		it("returns typed InventoryItem objects with all spec fields", async () => {
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
			expect(item.variantName).toBe("One");
			expect(item.clientId).toBe(INVENTORY_FLOWER.clientId);
			expect(item.locationId).toBe(INVENTORY_FLOWER.locationId);
			expect(item.locationName).toBe("Headquarters");
			expect(item.quantity).toBe(45);
			expect(item.costInMinorUnits).toBe(50);
			expect(item.postTaxPriceInPennies).toBe(100);
			expect(item.preTaxPriceInPennies).toBe(100);
			expect(item.priceInMinorUnits).toBe(100);
			expect(item.currencyCode).toBe("USD");
			expect(item.sku).toBe("h5aPEEmD8L");
			expect(item.effects).toEqual(["euphoric", "energetic"]);
			expect(item.parentProductId).toBe(INVENTORY_FLOWER.parentProductId);
			expect(item.parentProductName).toBe("Afghani Shake");
			expect(item.isSoldByWeight).toBe(false);
			expect(item.inventoryUnitOfMeasure).toBe("grams");
			expect(item.strainName).toBe("Afghani");
			expect(item.supplierName).toBe("Green Growers Co.");
			expect(item.regulatoryId).toBe(INVENTORY_FLOWER.regulatoryId);
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

	// ── listNonZero() ───────────────────────────────────────────────
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

	// ── listByRoomsNonZero() ────────────────────────────────────────
	describe("listByRoomsNonZero", () => {
		it("sends GET to /v0/inventoryByRoomsNonZero and returns ByRoom items", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventoryByRoomsNonZero`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_BY_ROOM_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listByRoomsNonZero();

			expect(result.status).toBe(200);
			expect(result.data).toHaveLength(1);
			expect(capturedUrl).toContain("/v0/inventoryByRoomsNonZero");

			const item = result.data[0]!;
			expect(item.roomId).toBe("room-001");
			expect(item.roomName).toBe("Main Floor");
			expect(item.upc).toBeNull();
			expect(item.productName).toBe(INVENTORY_BY_ROOM_FLOWER.productName);
		});
	});

	// ── listAnalytics() ─────────────────────────────────────────────
	describe("listAnalytics", () => {
		it("sends includesNotForSaleQuantity query param", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventoryAnalytics`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_ANALYTICS_RESPONSE);
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
					return HttpResponse.json(INVENTORY_ANALYTICS_RESPONSE);
				}),
			);

			const client = createClient();
			await client.inventory.listAnalytics();

			expect(capturedUrl).not.toContain("includesNotForSaleQuantity");
		});

		it("returns InventoryAnalyticsItem with forSale and supplierLicense", async () => {
			server.use(
				http.get(`${BASE_URL}/v0/inventoryAnalytics`, () => {
					return HttpResponse.json(INVENTORY_ANALYTICS_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listAnalytics();
			const item = result.data[0]!;

			expect(item.forSale).toBe(true);
			expect(item.supplierLicense).toBe("LIC-2023-001");
			expect(item.productName).toBe(INVENTORY_ANALYTICS_FLOWER.productName);
		});
	});

	// ── listAnalyticsByRooms() ──────────────────────────────────────
	describe("listAnalyticsByRooms", () => {
		it("sends GET to /v0/inventoryAnalyticsByRooms with analytics + room fields", async () => {
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/inventoryAnalyticsByRooms`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_ANALYTICS_BY_ROOM_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listAnalyticsByRooms({
				includesNotForSaleQuantity: true,
			});

			expect(capturedUrl).toContain("/v0/inventoryAnalyticsByRooms");
			expect(capturedUrl).toContain("includesNotForSaleQuantity=true");
			expect(result.data).toHaveLength(1);

			const item = result.data[0]!;
			expect(item.forSale).toBe(true);
			expect(item.supplierLicense).toBe("LIC-2023-001");
			expect(item.roomId).toBe("room-001");
			expect(item.roomName).toBe("Main Floor");
		});
	});

	// ── Per-location endpoints ──────────────────────────────────────
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

	describe("listByLocationNonZero", () => {
		it("sends GET to /v0/locations/{locationId}/inventoryNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/inventoryNonZero`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listByLocationNonZero(locationId);

			expect(result.status).toBe(200);
			expect(capturedUrl).toContain(`/v0/locations/${locationId}/inventoryNonZero`);
		});
	});

	describe("listByLocationByRoomsNonZero", () => {
		it("sends GET to /v0/locations/{locationId}/inventoryByRoomsNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/inventoryByRoomsNonZero`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_BY_ROOM_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listByLocationByRoomsNonZero(locationId);

			expect(result.status).toBe(200);
			expect(capturedUrl).toContain(`/v0/locations/${locationId}/inventoryByRoomsNonZero`);
		});
	});

	describe("listAnalyticsByLocation", () => {
		it("sends GET to /v0/locations/{locationId}/InventoryAnalytics (capital I)", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/InventoryAnalytics`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_ANALYTICS_RESPONSE);
				}),
			);

			const client = createClient();
			const result = await client.inventory.listAnalyticsByLocation(locationId, {
				includesNotForSaleQuantity: true,
			});

			expect(result.status).toBe(200);
			expect(capturedUrl).toContain(`/v0/locations/${locationId}/InventoryAnalytics`);
			expect(capturedUrl).toContain("includesNotForSaleQuantity=true");
		});
	});

	describe("listAnalyticsByLocationByRooms", () => {
		it("sends GET to /v0/locations/{locationId}/InventoryAnalyticsByRooms (capital I, R)", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(
					`${BASE_URL}/v0/locations/:locationId/InventoryAnalyticsByRooms`,
					({ request }) => {
						capturedUrl = request.url;
						return HttpResponse.json(INVENTORY_ANALYTICS_BY_ROOM_RESPONSE);
					},
				),
			);

			const client = createClient();
			const result = await client.inventory.listAnalyticsByLocationByRooms(locationId);

			expect(result.status).toBe(200);
			expect(capturedUrl).toContain(`/v0/locations/${locationId}/InventoryAnalyticsByRooms`);
		});
	});

	// ── Error handling ──────────────────────────────────────────────
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

	// ── Iterators ───────────────────────────────────────────────────
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

	// ── forLocation() scoping ───────────────────────────────────────
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

		it("routes listNonZero() to /v0/locations/{locationId}/inventoryNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/inventoryNonZero`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_LIST_RESPONSE);
				}),
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listNonZero();

			expect(capturedUrl).toContain(`/v0/locations/${locationId}/inventoryNonZero`);
		});

		it("routes listAnalytics() to /v0/locations/{locationId}/InventoryAnalytics (capital I)", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(`${BASE_URL}/v0/locations/:locationId/InventoryAnalytics`, ({ request }) => {
					capturedUrl = request.url;
					return HttpResponse.json(INVENTORY_ANALYTICS_RESPONSE);
				}),
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listAnalytics();

			expect(capturedUrl).toContain(`/v0/locations/${locationId}/InventoryAnalytics`);
		});

		it("routes listAnalyticsByRooms() to /v0/locations/{locationId}/InventoryAnalyticsByRooms", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			let capturedUrl = "";
			server.use(
				http.get(
					`${BASE_URL}/v0/locations/:locationId/InventoryAnalyticsByRooms`,
					({ request }) => {
						capturedUrl = request.url;
						return HttpResponse.json(INVENTORY_ANALYTICS_BY_ROOM_RESPONSE);
					},
				),
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listAnalyticsByRooms();

			expect(capturedUrl).toContain(`/v0/locations/${locationId}/InventoryAnalyticsByRooms`);
		});
	});
});
