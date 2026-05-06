import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubAuthError } from "../../src/errors.js";
import {
	INVENTORY_ANALYTICS_BY_ROOM_RESPONSE,
	INVENTORY_ANALYTICS_RESPONSE,
	INVENTORY_BY_ROOM_RESPONSE,
	INVENTORY_LIST_RESPONSE,
} from "../fixtures/inventory.fixtures.js";

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
	method: string;
	headers: Record<string, string>;
}

function captureGet(
	path: string,
	response: Record<string, unknown> | { status: number; data: readonly unknown[] },
	captured: CapturedRequest[] = [],
): CapturedRequest[] {
	server.use(
		http.get(`${BASE_URL}${path}`, ({ request }) => {
			captured.push({
				url: request.url,
				method: "GET",
				headers: {
					clientId: request.headers.get("clientId") ?? "",
					key: request.headers.get("key") ?? "",
				},
			});
			return HttpResponse.json(response);
		}),
	);
	return captured;
}

describe("InventoryResource", () => {
	// ── list() ──────────────────────────────────────────────────────
	describe("list", () => {
		it("sends GET /v0/inventory with clientId and key auth headers", async () => {
			const reqs = captureGet("/v0/inventory", INVENTORY_LIST_RESPONSE);

			const client = createClient();
			await client.inventory.list();

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(reqs[0]!.headers.key).toBe("test-api-key");
		});

		it("returns { status, data } envelope from server response", async () => {
			captureGet("/v0/inventory", INVENTORY_LIST_RESPONSE);

			const client = createClient();
			const result = await client.inventory.list();

			expect(result).toHaveProperty("status");
			expect(result).toHaveProperty("data");
			expect(typeof result.status).toBe("number");
			expect(Array.isArray(result.data)).toBe(true);
			expect(result.data).toHaveLength(2);
		});
	});

	// ── listNonZero() ───────────────────────────────────────────────
	describe("listNonZero", () => {
		it("sends GET to /v0/inventoryNonZero with auth", async () => {
			const reqs = captureGet("/v0/inventoryNonZero", INVENTORY_LIST_RESPONSE);

			const client = createClient();
			await client.inventory.listNonZero();

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v0/inventoryNonZero");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
		});
	});

	// ── listByRoomsNonZero() ────────────────────────────────────────
	describe("listByRoomsNonZero", () => {
		it("sends GET to /v0/inventoryByRoomsNonZero with auth", async () => {
			const reqs = captureGet("/v0/inventoryByRoomsNonZero", INVENTORY_BY_ROOM_RESPONSE);

			const client = createClient();
			await client.inventory.listByRoomsNonZero();

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v0/inventoryByRoomsNonZero");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
		});
	});

	// ── listAnalytics() ─────────────────────────────────────────────
	describe("listAnalytics", () => {
		it("sends includesNotForSaleQuantity=true when provided", async () => {
			const reqs = captureGet("/v0/inventoryAnalytics", INVENTORY_ANALYTICS_RESPONSE);

			const client = createClient();
			await client.inventory.listAnalytics({ includesNotForSaleQuantity: true });

			expect(reqs[0]!.url).toContain("includesNotForSaleQuantity=true");
		});

		it("omits includesNotForSaleQuantity when not provided", async () => {
			const reqs = captureGet("/v0/inventoryAnalytics", INVENTORY_ANALYTICS_RESPONSE);

			const client = createClient();
			await client.inventory.listAnalytics();

			expect(reqs[0]!.url).not.toContain("includesNotForSaleQuantity");
		});
	});

	// ── listAnalyticsByRooms() ──────────────────────────────────────
	describe("listAnalyticsByRooms", () => {
		it("sends GET to /v0/inventoryAnalyticsByRooms with query param", async () => {
			const reqs = captureGet(
				"/v0/inventoryAnalyticsByRooms",
				INVENTORY_ANALYTICS_BY_ROOM_RESPONSE,
			);

			const client = createClient();
			await client.inventory.listAnalyticsByRooms({ includesNotForSaleQuantity: true });

			expect(reqs[0]!.url).toContain("/v0/inventoryAnalyticsByRooms");
			expect(reqs[0]!.url).toContain("includesNotForSaleQuantity=true");
		});
	});

	// ── Per-location endpoints ──────────────────────────────────────
	describe("listByLocation", () => {
		it("sends locationId in path to /v0/locations/{id}/inventory", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet("/v0/locations/:locationId/inventory", INVENTORY_LIST_RESPONSE);

			const client = createClient();
			await client.inventory.listByLocation(locationId);

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/inventory`);
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
		});
	});

	describe("listByLocationNonZero", () => {
		it("sends locationId in path to /v0/locations/{id}/inventoryNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/inventoryNonZero",
				INVENTORY_LIST_RESPONSE,
			);

			const client = createClient();
			await client.inventory.listByLocationNonZero(locationId);

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/inventoryNonZero`);
		});
	});

	describe("listByLocationByRoomsNonZero", () => {
		it("sends locationId in path to /v0/locations/{id}/inventoryByRoomsNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/inventoryByRoomsNonZero",
				INVENTORY_BY_ROOM_RESPONSE,
			);

			const client = createClient();
			await client.inventory.listByLocationByRoomsNonZero(locationId);

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/inventoryByRoomsNonZero`);
		});
	});

	describe("listAnalyticsByLocation", () => {
		it("sends to /v0/locations/{id}/InventoryAnalytics (capital I) with query param", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/InventoryAnalytics",
				INVENTORY_ANALYTICS_RESPONSE,
			);

			const client = createClient();
			await client.inventory.listAnalyticsByLocation(locationId, {
				includesNotForSaleQuantity: true,
			});

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/InventoryAnalytics`);
			expect(reqs[0]!.url).toContain("includesNotForSaleQuantity=true");
		});
	});

	describe("listAnalyticsByLocationByRooms", () => {
		it("sends to /v0/locations/{id}/InventoryAnalyticsByRooms (capital I, R)", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/InventoryAnalyticsByRooms",
				INVENTORY_ANALYTICS_BY_ROOM_RESPONSE,
			);

			const client = createClient();
			await client.inventory.listAnalyticsByLocationByRooms(locationId);

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/InventoryAnalyticsByRooms`);
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

	// ── forLocation() scoping ───────────────────────────────────────
	describe("forLocation scoping", () => {
		it("routes list() to /v0/locations/{locationId}/inventory", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet("/v0/locations/:locationId/inventory", INVENTORY_LIST_RESPONSE);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.list();

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/inventory`);
		});

		it("routes listNonZero() to /v0/locations/{locationId}/inventoryNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/inventoryNonZero",
				INVENTORY_LIST_RESPONSE,
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listNonZero();

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/inventoryNonZero`);
		});

		it("routes listByRoomsNonZero() to /v0/locations/{locationId}/inventoryByRoomsNonZero", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/inventoryByRoomsNonZero",
				INVENTORY_BY_ROOM_RESPONSE,
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listByRoomsNonZero();

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/inventoryByRoomsNonZero`);
		});

		it("routes listAnalytics() to /v0/locations/{locationId}/InventoryAnalytics (capital I)", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/InventoryAnalytics",
				INVENTORY_ANALYTICS_RESPONSE,
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listAnalytics();

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/InventoryAnalytics`);
		});

		it("routes listAnalyticsByRooms() to /v0/locations/{locationId}/InventoryAnalyticsByRooms", async () => {
			const locationId = "5e746577-ee54-4796-9ee0-d28f45c48deb";
			const reqs = captureGet(
				"/v0/locations/:locationId/InventoryAnalyticsByRooms",
				INVENTORY_ANALYTICS_BY_ROOM_RESPONSE,
			);

			const scoped = createClient().forLocation(locationId);
			await scoped.inventory.listAnalyticsByRooms();

			expect(reqs[0]!.url).toContain(`/v0/locations/${locationId}/InventoryAnalyticsByRooms`);
		});
	});
});
