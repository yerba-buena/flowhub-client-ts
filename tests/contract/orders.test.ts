import { http, HttpResponse, type JsonBodyType } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";
import { FlowhubAuthError } from "../../src/errors.js";
import { CUSTOMER_FIXTURE, ORDERS_LIST_RESPONSE } from "../fixtures/orders.fixtures.js";

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
	body: unknown;
}

function capture(
	method: "get" | "post" | "put",
	path: string,
	response: JsonBodyType,
	status = 200,
): CapturedRequest[] {
	const captured: CapturedRequest[] = [];
	const handler = http[method](`${BASE_URL}${path}`, async ({ request }) => {
		let body: unknown = null;
		if (method !== "get") {
			body = await request.json().catch(() => null);
		}
		captured.push({
			url: request.url,
			method: method.toUpperCase(),
			headers: {
				clientId: request.headers.get("clientId") ?? "",
				key: request.headers.get("key") ?? "",
			},
			body,
		});
		return HttpResponse.json(response, { status });
	});
	server.use(handler);
	return captured;
}

// ── Customers ───────────────────────────────────────────────────────

describe("OrdersResource — Customers", () => {
	describe("getCustomers", () => {
		it("sends GET /v1/customers/ with clientId and key headers", async () => {
			const reqs = capture("get", "/v1/customers/", CUSTOMER_FIXTURE);

			const client = createClient();
			await client.orders.getCustomers();

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v1/customers/");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(reqs[0]!.headers.key).toBe("test-api-key");
		});

		it("passes pagination and filter query params", async () => {
			const reqs = capture("get", "/v1/customers/", CUSTOMER_FIXTURE);

			const client = createClient();
			await client.orders.getCustomers({
				created_after: "2026-01-01",
				created_before: "2026-05-01",
				page: 2,
				page_size: 25,
				order_by: "desc",
				updated_after: "2026-04-01",
				updated_before: "2026-05-01",
			});

			const url = reqs[0]!.url;
			expect(url).toContain("created_after=2026-01-01");
			expect(url).toContain("created_before=2026-05-01");
			expect(url).toContain("page=2");
			expect(url).toContain("page_size=25");
			expect(url).toContain("order_by=desc");
			expect(url).toContain("updated_after=2026-04-01");
			expect(url).toContain("updated_before=2026-05-01");
		});
	});

	describe("getCustomerById", () => {
		it("sends GET /v1/customers/{customerId} with auth headers", async () => {
			const reqs = capture("get", "/v1/customers/:customerId", CUSTOMER_FIXTURE);

			const client = createClient();
			const result = await client.orders.getCustomerById("cust-123");

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v1/customers/cust-123");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(result.id).toBe(CUSTOMER_FIXTURE.id);
			expect(result.name).toBe(CUSTOMER_FIXTURE.name);
		});

		it("passes store_id query param for loyalty points", async () => {
			const reqs = capture("get", "/v1/customers/:customerId", {
				...CUSTOMER_FIXTURE,
				loyaltyPointsInPennies: 5000,
			});

			const client = createClient();
			const result = await client.orders.getCustomerById("cust-123", {
				store_id: "store-001",
			});

			expect(reqs[0]!.url).toContain("store_id=store-001");
			expect(result.loyaltyPointsInPennies).toBe(5000);
		});
	});

	describe("getCustomerByPhone", () => {
		it("sends GET /v1/customers/findByPhoneNumber with phone_number query param", async () => {
			const reqs = capture("get", "/v1/customers/findByPhoneNumber", CUSTOMER_FIXTURE);

			const client = createClient();
			const result = await client.orders.getCustomerByPhone("5551234567");

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("phone_number=5551234567");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(result.name).toBe(CUSTOMER_FIXTURE.name);
		});
	});

	describe("createCustomer", () => {
		it("sends POST /v1/customer with store_id, clientId, key, and body", async () => {
			const reqs = capture("post", "/v1/customer", CUSTOMER_FIXTURE);

			const client = createClient();
			const result = await client.orders.createCustomer("store-001", {
				birthDate: "1990-05-15",
				name: "Jane Doe",
				state: "CO",
				type: "recCustomer",
				email: "jane@example.com",
				phone: "5551234567",
			});

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("store_id=store-001");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(reqs[0]!.headers.key).toBe("test-api-key");
			const body = reqs[0]!.body as Record<string, unknown>;
			expect(body.birthDate).toBe("1990-05-15");
			expect(body.name).toBe("Jane Doe");
			expect(body.state).toBe("CO");
			expect(body.type).toBe("recCustomer");
			expect(body.email).toBe("jane@example.com");
			expect(body.phone).toBe("5551234567");
			expect(result.id).toBe(CUSTOMER_FIXTURE.id);
		});
	});

	describe("updateCustomer", () => {
		it("sends PUT /v1/customer/{customerId} with store_id, auth, and body", async () => {
			const reqs = capture("put", "/v1/customer/:customerId", CUSTOMER_FIXTURE);

			const client = createClient();
			const result = await client.orders.updateCustomer("cust-123", "store-001", {
				birthDate: "1990-05-15",
				name: "Jane Smith",
				state: "CO",
				type: "recCustomer",
			});

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v1/customer/cust-123");
			expect(reqs[0]!.url).toContain("store_id=store-001");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(reqs[0]!.headers.key).toBe("test-api-key");
			const body = reqs[0]!.body as Record<string, unknown>;
			expect(body.birthDate).toBe("1990-05-15");
			expect(body.name).toBe("Jane Smith");
			expect(body.state).toBe("CO");
			expect(body.type).toBe("recCustomer");
			expect(result.id).toBe(CUSTOMER_FIXTURE.id);
		});
	});

	describe("error handling", () => {
		it("throws FlowhubAuthError on 401", async () => {
			server.use(
				http.get(`${BASE_URL}/v1/customers/`, () => {
					return HttpResponse.json(
						{ error: ["Unauthorized"], message: "Invalid key", status: 401 },
						{ status: 401 },
					);
				}),
			);

			const client = createClient();
			await expect(client.orders.getCustomers()).rejects.toThrow(FlowhubAuthError);
		});
	});
});

// ── Orders (Sales) ──────────────────────────────────────────────────

describe("OrdersResource — Sales", () => {
	describe("listByCustomerId", () => {
		it("sends GET /v1/orders/findByCustomerId/{customerId} with auth", async () => {
			const reqs = capture("get", "/v1/orders/findByCustomerId/:customerId", ORDERS_LIST_RESPONSE);

			const client = createClient();
			const result = await client.orders.listByCustomerId("cust-123");

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v1/orders/findByCustomerId/cust-123");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(reqs[0]!.headers.key).toBe("test-api-key");
			expect(result.total).toBe(1);
			expect(result.orders).toHaveLength(1);
			expect(result.orders[0]!.orderId).toBe("order-001");
		});

		it("passes pagination query params", async () => {
			const reqs = capture("get", "/v1/orders/findByCustomerId/:customerId", ORDERS_LIST_RESPONSE);

			const client = createClient();
			await client.orders.listByCustomerId("cust-123", {
				created_after: "2026-01-01",
				created_before: "2026-05-01",
				page: 1,
				page_size: 50,
				order_by: "asc",
			});

			const url = reqs[0]!.url;
			expect(url).toContain("created_after=2026-01-01");
			expect(url).toContain("created_before=2026-05-01");
			expect(url).toContain("page=1");
			expect(url).toContain("page_size=50");
			expect(url).toContain("order_by=asc");
		});
	});

	describe("listByLocationId", () => {
		it("sends GET /v1/orders/findByLocationId/{importId} with auth", async () => {
			const reqs = capture("get", "/v1/orders/findByLocationId/:importId", ORDERS_LIST_RESPONSE);

			const client = createClient();
			const result = await client.orders.listByLocationId("loc-001");

			expect(reqs).toHaveLength(1);
			expect(reqs[0]!.url).toContain("/v1/orders/findByLocationId/loc-001");
			expect(reqs[0]!.headers.clientId).toBe("test-client-id");
			expect(reqs[0]!.headers.key).toBe("test-api-key");
			expect(result.total).toBe(1);
			expect(result.orders[0]!.orderStatus).toBe("Sold");
		});

		it("passes pagination query params", async () => {
			const reqs = capture("get", "/v1/orders/findByLocationId/:importId", ORDERS_LIST_RESPONSE);

			const client = createClient();
			await client.orders.listByLocationId("loc-001", {
				created_after: "2026-04-01",
				page: 3,
				page_size: 100,
				order_by: "desc",
			});

			const url = reqs[0]!.url;
			expect(url).toContain("created_after=2026-04-01");
			expect(url).toContain("page=3");
			expect(url).toContain("page_size=100");
			expect(url).toContain("order_by=desc");
		});
	});
});
