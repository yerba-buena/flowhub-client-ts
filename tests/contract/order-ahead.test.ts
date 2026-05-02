import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

const BASE_URL = "https://api.test.flowhub.co";

const server = setupServer(
	http.patch(`${BASE_URL}/orders/submit`, ({ request }) => {
		const auth = request.headers.get("Authorization");
		if (!auth?.startsWith("Bearer ")) {
			return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		return HttpResponse.json({});
	}),
	http.patch(`${BASE_URL}/orders/cancel`, () => HttpResponse.json({})),
	http.patch(`${BASE_URL}/orders/confirm`, () => HttpResponse.json({})),
	http.patch(`${BASE_URL}/orders/complete`, () => HttpResponse.json({})),
	http.patch(`${BASE_URL}/orders/status`, () => HttpResponse.json({})),
	http.patch(`${BASE_URL}/orders/update`, () => HttpResponse.json({})),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient() {
	return new FlowhubClient({
		clientId: "test-client-id",
		apiKey: "test-api-key",
		accessToken: "test-bearer-token",
		baseUrl: BASE_URL,
		retries: 0,
	});
}

describe("OrderAheadResource", () => {
	it("sends PATCH to /orders/submit with Bearer auth", async () => {
		let capturedAuth = "";
		let capturedBody: unknown = null;
		server.use(
			http.patch(`${BASE_URL}/orders/submit`, async ({ request }) => {
				capturedAuth = request.headers.get("authorization") ?? "";
				capturedBody = await request.json();
				return HttpResponse.json({});
			}),
		);

		const client = createClient();
		await client.orderAhead.submit({
			locationId: "loc-123",
			customerId: "cust-456",
			items: [{ productId: "prod-1", variantId: "var-1", quantity: 2, priceInMinorUnits: 1000 }],
		});

		expect(capturedAuth).toBe("Bearer test-bearer-token");
		expect(capturedBody).toMatchObject({ locationId: "loc-123", customerId: "cust-456" });
	});

	it("sends PATCH to /orders/cancel", async () => {
		const client = createClient();
		const result = await client.orderAhead.cancel({ orderId: "order-789" });
		expect(result).toEqual({});
	});

	it("sends PATCH to /orders/confirm", async () => {
		const client = createClient();
		const result = await client.orderAhead.confirm({ orderId: "order-789" });
		expect(result).toEqual({});
	});

	it("sends PATCH to /orders/complete", async () => {
		const client = createClient();
		const result = await client.orderAhead.complete({ orderId: "order-789" });
		expect(result).toEqual({});
	});

	it("sends PATCH to /orders/status", async () => {
		const client = createClient();
		const result = await client.orderAhead.updateStatus({ orderId: "order-789", status: "ready" });
		expect(result).toEqual({});
	});

	it("sends PATCH to /orders/update", async () => {
		const client = createClient();
		const result = await client.orderAhead.update({ orderId: "order-789", notes: "updated" });
		expect(result).toEqual({});
	});
});
