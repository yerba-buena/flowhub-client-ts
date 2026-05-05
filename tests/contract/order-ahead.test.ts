import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

const BASE_URL = "https://api.test.flowhub.co";

const ORDER_RESPONSE = {
	customerExternalId: "cust-ext-001",
	orderId: "order-001",
	status: "new" as const,
};

const server = setupServer();

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

interface CapturedRequest {
	url: string;
	method: string;
	authorization: string;
	accept: string;
	body: unknown;
}

describe("OrderAheadResource", () => {
	it("POST /order-ahead/v0/create sends Bearer auth and order body", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
				captured.push({
					url: request.url,
					method: "POST",
					authorization: request.headers.get("authorization") ?? "",
					accept: request.headers.get("accept") ?? "",
					body: await request.json(),
				});
				return HttpResponse.json(ORDER_RESPONSE);
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.create(ORDER_PARAMS);

		expect(captured).toHaveLength(1);
		expect(captured[0]!.authorization).toBe("Bearer test-token");
		expect(captured[0]!.body).toMatchObject({
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

	it("POST /order-ahead/v0/create sends all optional fields", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.post(`${BASE_URL}/order-ahead/v0/create`, async ({ request }) => {
				captured.push({
					url: request.url,
					method: "POST",
					authorization: request.headers.get("authorization") ?? "",
					accept: "",
					body: await request.json(),
				});
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

		const body = captured[0]!.body as Record<string, unknown>;
		expect(body.address).toMatchObject({ street1: "123 Main St", city: "Denver" });
		expect(body.customerId).toBe("cust-001");
		expect(body.cartDiscountNote).toBe("10% off");
		expect(body.customerNote).toBe("Ring doorbell");
		expect(body.requestedFulfillmentTimeStart).toBe("2026-05-01T14:00:00Z");
		expect(body.requestedFulfillmentTimeEnd).toBe("2026-05-01T15:00:00Z");
		expect(body.postbackUrl).toBe("https://example.com/hook");
		expect(body.fees).toMatchObject([{ name: "Delivery", amount: 500 }]);
		expect(body.loyaltyPointsInPennies).toBe(1000);
	});

	it("PATCH /orders/{orderId} sends body to correct path with auth", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.patch(`${BASE_URL}/orders/:orderId`, async ({ request }) => {
				captured.push({
					url: request.url,
					method: "PATCH",
					authorization: request.headers.get("authorization") ?? "",
					accept: "",
					body: await request.json(),
				});
				return HttpResponse.json({
					customerExternalId: "cust-ext-001",
					orderId: "order-123",
					status: "started",
				});
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.update("order-123", ORDER_PARAMS);

		expect(captured).toHaveLength(1);
		expect(captured[0]!.url).toContain("/orders/order-123");
		expect(captured[0]!.authorization).toBe("Bearer test-token");
		expect((captured[0]!.body as Record<string, unknown>).externalCreatedAt).toBe(
			"2026-05-01T12:00:00Z",
		);
		expect(result.orderId).toBe("order-123");
		expect(result.status).toBe("started");
	});

	it("POST /orderPostback/{orderId} sends POST to correct path and returns void", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.post(`${BASE_URL}/orderPostback/:orderId`, ({ request }) => {
				captured.push({
					url: request.url,
					method: "POST",
					authorization: request.headers.get("authorization") ?? "",
					accept: "",
					body: null,
				});
				return new HttpResponse(null, { status: 204 });
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.postback("order-456");

		expect(captured).toHaveLength(1);
		expect(captured[0]!.url).toContain("/orderPostback/order-456");
		expect(captured[0]!.authorization).toBe("Bearer test-token");
		expect(result).toBeUndefined();
	});

	it("GET /order-ahead/v0/orderStatus/{orderId} sends GET to correct path with auth", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.get(`${BASE_URL}/order-ahead/v0/orderStatus/:orderId`, ({ request }) => {
				captured.push({
					url: request.url,
					method: "GET",
					authorization: request.headers.get("authorization") ?? "",
					accept: "",
					body: null,
				});
				return HttpResponse.json({
					customerExternalId: "cust-ext-001",
					orderId: "order-789",
					status: "ready",
				});
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.getStatus("order-789");

		expect(captured).toHaveLength(1);
		expect(captured[0]!.url).toContain("/order-ahead/v0/orderStatus/order-789");
		expect(captured[0]!.authorization).toBe("Bearer test-token");
		expect(result.orderId).toBe("order-789");
		expect(result.status).toBe("ready");
	});

	it("GET /authTest uses requestText with Accept: text/plain", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.get(`${BASE_URL}/authTest`, ({ request }) => {
				captured.push({
					url: request.url,
					method: "GET",
					authorization: request.headers.get("authorization") ?? "",
					accept: request.headers.get("accept") ?? "",
					body: null,
				});
				return HttpResponse.text("ok");
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.testAuth();

		expect(captured).toHaveLength(1);
		expect(captured[0]!.url).toContain("/authTest");
		expect(captured[0]!.accept).toBe("text/plain");
		expect(captured[0]!.authorization).toBe("Bearer test-token");
		expect(result).toBe("ok");
	});

	it("GET /health uses requestText with Accept: text/plain", async () => {
		const captured: CapturedRequest[] = [];
		server.use(
			http.get(`${BASE_URL}/health`, ({ request }) => {
				captured.push({
					url: request.url,
					method: "GET",
					authorization: request.headers.get("authorization") ?? "",
					accept: request.headers.get("accept") ?? "",
					body: null,
				});
				return HttpResponse.text("healthy");
			}),
		);

		const client = createClient();
		const result = await client.orderAhead.health();

		expect(captured).toHaveLength(1);
		expect(captured[0]!.url).toContain("/health");
		expect(captured[0]!.accept).toBe("text/plain");
		expect(result).toBe("healthy");
	});
});
