import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

const BASE_URL = "https://api.test.flowhub.co";

const server = setupServer(
	http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
		const auth = request.headers.get("authorization");
		if (auth !== "Bearer test-token") {
			return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		const body = (await request.json()) as Record<string, unknown>;
		return HttpResponse.json({ orderId: "order-001", ...body });
	}),
	http.patch(`${BASE_URL}/orders/:orderId`, async ({ params }) => {
		return HttpResponse.json({ orderId: params.orderId, updated: true });
	}),
	http.post(`${BASE_URL}/orderPostback/:orderId`, ({ params }) => {
		return HttpResponse.json({ orderId: params.orderId, posted: true });
	}),
	http.get(`${BASE_URL}/order-ahead/v0/orderStatus/:orderId`, ({ params }) => {
		return HttpResponse.json({ orderId: params.orderId, status: "confirmed" });
	}),
	http.get(`${BASE_URL}/authTest`, () => HttpResponse.text("ok")),
	http.get(`${BASE_URL}/health`, () => HttpResponse.text("healthy")),
);

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function createClient() {
	return new FlowhubClient({
		clientId: "test-client-id",
		apiKey: "test-api-key",
		accessToken: "test-token",
		baseUrl: BASE_URL,
		retries: 0,
	});
}

const ORDER_PARAMS = {
	externalCreatedAt: "2026-05-01T12:00:00Z",
	customer: {
		firstName: "Jane",
		lastName: "Doe",
		email: "jane@example.com",
		phone: "+15551234567",
		medRecOrBoth: "rec" as const,
	},
	orderItems: [{ productId: 42, quantityPurchased: 2 }],
	orderType: "pickup" as const,
} as const;

describe("OrderAheadResource", () => {
	it("POST /order-ahead/v0/create with Bearer auth and order body", async () => {
		let capturedAuth = "";
		let capturedBody: unknown = null;
		server.use(
			http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
				capturedAuth = request.headers.get("authorization") ?? "";
				capturedBody = await request.json();
				return HttpResponse.json({ orderId: "order-001" });
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.create(ORDER_PARAMS);

		expect(capturedAuth).toBe("Bearer test-token");
		expect(capturedBody).toMatchObject({
			externalCreatedAt: "2026-05-01T12:00:00Z",
			customer: { firstName: "Jane" },
			orderItems: [{ productId: 42, quantityPurchased: 2 }],
			orderType: "pickup",
		});
		expect(result).toMatchObject({ orderId: "order-001" });
	});

	it("PATCH /orders/{orderId} updates an existing order", async () => {
		const client = createClient();
		const result = await client.orderAhead.update("order-123", ORDER_PARAMS);
		expect(result).toMatchObject({ orderId: "order-123", updated: true });
	});

	it("POST /orderPostback/{orderId} triggers postback", async () => {
		const client = createClient();
		const result = await client.orderAhead.postback("order-456");
		expect(result).toMatchObject({ orderId: "order-456", posted: true });
	});

	it("GET /order-ahead/v0/orderStatus/{orderId} returns status", async () => {
		const client = createClient();
		const result = await client.orderAhead.getStatus("order-789");
		expect(result).toMatchObject({ orderId: "order-789", status: "confirmed" });
	});
});
