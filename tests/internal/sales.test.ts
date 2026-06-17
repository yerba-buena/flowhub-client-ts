import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubInternalClient } from "../../src/internal/client.js";

const BASE_URL = "https://api.flowhub.com";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeLoginPayload(tokenId = "tok-1") {
	const nowSeconds = Math.floor(Date.now() / 1000);
	return {
		data: {
			login: { id: tokenId, refreshId: "refresh-xyz", expireTime: nowSeconds + 4 * 60 * 60 },
		},
	};
}

type GqlHandlerResult = Record<string, unknown> | Response;
type GqlRoutes = Record<
	string,
	((req: { variables: Record<string, unknown> }) => GqlHandlerResult) | undefined
>;

function gqlRouter(routes: GqlRoutes) {
	return http.post(`${BASE_URL}/graph/query`, async ({ request }) => {
		const body = (await request.json()) as {
			operationName: string;
			variables: Record<string, unknown>;
		};
		const handler = routes[body.operationName];
		if (!handler) return new HttpResponse(`No handler for ${body.operationName}`, { status: 500 });
		const result = handler({ variables: body.variables });
		if (result instanceof Response) return result;
		return HttpResponse.json(result);
	});
}

function makeClient() {
	return new FlowhubInternalClient({
		email: "user@example.com",
		password: "pw",
		baseUrl: BASE_URL,
	});
}

const RAW_SALE = {
	id: "e8e5d921-b949-4a2f-a740-4add3bb5be6a",
	source: "in-store-fulfillment",
	receiptId: "R-1001",
	storeId: "store-1",
	storeName: "Cobble Hill",
	purchaseType: "REC",
	completedAt: "2026-06-17T14:24:53.741733Z",
	editedCount: null,
	soldBy: {
		id: "2a806c5b-9729-46b0-a8cd-bc290afb51ce",
		meta: { firstName: "Mark", lastName: "Murtha" },
	},
	drawer: { id: "cffe54a0-919f-43d2-a873-01c9a9409e73", name: "POS 2" },
	totalPreTaxPrice: 1062,
	totalPostTaxPrice: 1200,
	totalItemPrice: 1062,
	totalDiscounts: 0,
	totalTaxes: 138,
	totalFees: 0,
	totalPrice: 1200,
	loyalty: { pointsEarned: 0, pointsSpent: 0 },
	items: [
		{
			id: "i1",
			productName: "Old Pal | Preroll 2pk",
			brand: "Old Pal",
			sku: "X1",
			quantity: 2,
			preTaxPrice: 500,
			postTaxPrice: 560,
			totalPrice: 1120,
			totalDiscounts: 0,
			totalTaxes: 60,
			totalItemCost: 250,
		},
		{
			id: "i2",
			productName: "Gummies",
			brand: "Wyld",
			sku: "X2",
			quantity: 3,
			preTaxPrice: 187,
			postTaxPrice: 213,
			totalPrice: 639,
			totalDiscounts: 0,
			totalTaxes: 78,
			totalItemCost: 90,
		},
	],
};

describe("SalesResource", () => {
	it("maps filteredSales into Sale shape (soldBy, cents totals, derived itemCount)", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetSales: ({ variables }) => {
					capturedVars = variables;
					return { data: { sales: [RAW_SALE] } };
				},
			}),
		);

		const [sale] = await makeClient().sales.list({
			startDate: "2026-06-17",
			endDate: "2026-06-17",
		});

		expect(sale).toMatchObject({
			id: "e8e5d921-b949-4a2f-a740-4add3bb5be6a",
			purchaseType: "REC",
			totalPrice: 1200,
			soldBy: { id: "2a806c5b-9729-46b0-a8cd-bc290afb51ce", name: "Mark Murtha" },
			drawer: { name: "POS 2" },
			itemCount: 5, // 2 + 3
		});
		// sensible defaults applied
		expect(capturedVars).toMatchObject({
			startDate: "2026-06-17",
			endDate: "2026-06-17",
			reportingStatus: "all",
			orderBy: "completedAt",
			orderDirection: "desc",
			shouldIncludeAllStores: false,
		});
	});

	it("passes the employeeIds filter through (per-budtender query)", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetSales: ({ variables }) => {
					capturedVars = variables;
					return { data: { sales: [] } };
				},
			}),
		);

		await makeClient().sales.list({
			startDate: "2026-06-01",
			endDate: "2026-06-17",
			employeeIds: ["2a806c5b-9729-46b0-a8cd-bc290afb51ce"],
			search: "jose",
		});

		expect(capturedVars).toMatchObject({
			employeeIds: ["2a806c5b-9729-46b0-a8cd-bc290afb51ce"],
			search: "jose",
		});
	});

	it("listAll() auto-paginates until a short page", async () => {
		const offsets: number[] = [];
		const page = (n: number) =>
			Array.from({ length: n }, (_, i) => ({ ...RAW_SALE, id: `s-${i}` }));
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetSales: ({ variables }) => {
					const offset = variables.offset as number;
					offsets.push(offset);
					return { data: { sales: page(offset === 0 ? 100 : 12) } };
				},
			}),
		);

		const all = await makeClient().sales.listAll({
			startDate: "2026-06-01",
			endDate: "2026-06-17",
		});
		expect(all).toHaveLength(112);
		expect(offsets).toEqual([0, 100]);
	});

	it("get() fetches a single sale by id or returns null", async () => {
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetSales: ({ variables }) =>
					variables.id === "missing" ? { data: { sales: [] } } : { data: { sales: [RAW_SALE] } },
			}),
		);

		const client = makeClient();
		expect(await client.sales.get(RAW_SALE.id)).toMatchObject({ receiptId: "R-1001" });
		expect(await client.sales.get("missing")).toBeNull();
	});

	it("handles null soldBy / items", async () => {
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetSales: () => ({ data: { sales: [{ ...RAW_SALE, soldBy: null, items: null }] } }),
			}),
		);

		const [sale] = await makeClient().sales.list({
			startDate: "2026-06-17",
			endDate: "2026-06-17",
		});
		expect(sale).toMatchObject({ soldBy: null, items: [], itemCount: 0 });
	});

	it("retries once on 401 by re-logging in", async () => {
		let attempts = 0;
		const loginCounter = { count: 0 };
		server.use(
			http.post(`${BASE_URL}/graph/query`, async ({ request }) => {
				const body = (await request.json()) as { operationName: string };
				if (body.operationName === "Login") {
					loginCounter.count++;
					return HttpResponse.json(makeLoginPayload("fresh"));
				}
				attempts++;
				if (attempts === 1) return new HttpResponse("unauthorized", { status: 401 });
				return HttpResponse.json({ data: { sales: [RAW_SALE] } });
			}),
		);

		const sales = await makeClient().sales.list({ startDate: "2026-06-17", endDate: "2026-06-17" });
		expect(sales[0]?.id).toBe(RAW_SALE.id);
		expect(attempts).toBe(2);
		expect(loginCounter.count).toBe(2);
	});
});
