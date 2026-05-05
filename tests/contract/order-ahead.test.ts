import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import type { OrderStatus } from "../../src/types/orders.js";

const BASE_URL = "https://api.test.flowhub.co";

const VALID_STATUSES: OrderStatus[] = [
	"new",
	"started",
	"ready",
	"inQueue",
	"inTransit",
	"delivered",
	"unableToComplete",
	"unableToVerify",
	"deleted",
	"sold",
];

const ORDER_RESPONSE = {
	customerExternalId: "cust-ext-001",
	orderId: "order-001",
	status: "new" as const,
};

const server = setupServer(
	http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
		const auth = request.headers.get("authorization");
		if (auth !== "Bearer test-token") {
			return HttpResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		return HttpResponse.json(ORDER_RESPONSE);
	}),
	http.patch(`${BASE_URL}/orders/:orderId`, async ({ params }) => {
		return HttpResponse.json({
			customerExternalId: "cust-ext-001",
			orderId: params.orderId,
			status: "started",
		});
	}),
	http.post(`${BASE_URL}/orderPostback/:orderId`, () => {
		return new HttpResponse(null, { status: 204 });
	}),
	http.get(`${BASE_URL}/order-ahead/v0/orderStatus/:orderId`, ({ params }) => {
		return HttpResponse.json({
			customerExternalId: "cust-ext-001",
			orderId: params.orderId,
			status: "ready",
		});
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
	it("POST /order-ahead/v0/create sends Bearer auth and order body", async () => {
		let capturedAuth = "";
		let capturedBody: unknown = null;
		server.use(
			http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
				capturedAuth = request.headers.get("authorization") ?? "";
				capturedBody = await request.json();
				return HttpResponse.json(ORDER_RESPONSE);
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.create(ORDER_PARAMS);

		expect(capturedAuth).toBe("Bearer test-token");
		expect(capturedBody).toMatchObject({
			externalCreatedAt: "2026-05-01T12:00:00Z",
			customer: {
				firstName: "Jane",
				lastName: "Doe",
				email: "jane@example.com",
				phone: "+15551234567",
				medRecOrBoth: "rec",
			},
			orderItems: [{ productId: 42, quantityPurchased: 2 }],
			orderType: "pickup",
		});
		expect(result.orderId).toBe("order-001");
		expect(result.customerExternalId).toBe("cust-ext-001");
		expect(result.status).toBe("new");
	});

	it("POST /order-ahead/v0/create sends optional fields when provided", async () => {
		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json(ORDER_RESPONSE);
			}),
		);

		const client = createClient();
		await client.orderAhead.create({
			...ORDER_PARAMS,
			address: {
				street1: "123 Main St",
				street2: "Apt 4",
				city: "Denver",
				state: "CO",
				zip: "80202",
			},
			customerId: "cust-001",
			cartDiscountNote: "10% off",
			customerNote: "Ring doorbell",
			requestedFulfillmentTimeStart: "2026-05-01T14:00:00Z",
			requestedFulfillmentTimeEnd: "2026-05-01T15:00:00Z",
			postbackUrl: "https://example.com/hook",
			fees: [{ name: "Delivery", amount: 500 }],
			loyaltyPointsInPennies: 1000,
		});

		expect(capturedBody.address).toMatchObject({
			street1: "123 Main St",
			street2: "Apt 4",
			city: "Denver",
			state: "CO",
			zip: "80202",
		});
		expect(capturedBody.customerId).toBe("cust-001");
		expect(capturedBody.cartDiscountNote).toBe("10% off");
		expect(capturedBody.customerNote).toBe("Ring doorbell");
		expect(capturedBody.requestedFulfillmentTimeStart).toBe("2026-05-01T14:00:00Z");
		expect(capturedBody.requestedFulfillmentTimeEnd).toBe("2026-05-01T15:00:00Z");
		expect(capturedBody.postbackUrl).toBe("https://example.com/hook");
		expect(capturedBody.fees).toMatchObject([{ name: "Delivery", amount: 500 }]);
		expect(capturedBody.loyaltyPointsInPennies).toBe(1000);
	});

	it("PATCH /orders/{orderId} sends body and returns OrderResponse", async () => {
		let capturedBody: Record<string, unknown> = {};
		server.use(
			http.patch(`${BASE_URL}/orders/:orderId`, async ({ request, params }) => {
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({
					customerExternalId: "cust-ext-001",
					orderId: params.orderId,
					status: "started",
				});
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.update("order-123", ORDER_PARAMS);

		expect(capturedBody.externalCreatedAt).toBe("2026-05-01T12:00:00Z");
		expect(capturedBody.customer).toMatchObject({ firstName: "Jane" });
		expect(result.orderId).toBe("order-123");
		expect(result.status).toBe("started");
		expect(result.customerExternalId).toBe("cust-ext-001");
	});

	it("POST /orderPostback/{orderId} returns 204 No Content", async () => {
		const client = createClient();
		const result = await client.orderAhead.postback("order-456");
		expect(result).toBeUndefined();
	});

	it("GET /order-ahead/v0/orderStatus/{orderId} returns spec-valid status", async () => {
		const client = createClient();
		const result = await client.orderAhead.getStatus("order-789");

		expect(result.orderId).toBe("order-789");
		expect(result.customerExternalId).toBe("cust-ext-001");
		expect(result.status).toBe("ready");
		expect(VALID_STATUSES).toContain(result.status);
	});

	it("GET /authTest returns text response", async () => {
		const client = createClient();
		const result = await client.orderAhead.testAuth();
		expect(result).toBe("ok");
	});

	it("GET /health returns text response", async () => {
		const client = createClient();
		const result = await client.orderAhead.health();
		expect(result).toBe("healthy");
	});
});
