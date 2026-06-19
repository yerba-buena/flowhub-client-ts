import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubAuthError } from "../../src/errors.js";
import { FlowhubInternalClient } from "../../src/internal/client.js";

const BASE_URL = "https://api.flowhub.com";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function loginHandler(
	opts: { tokenId: string; loginCounter?: { count: number } } = { tokenId: "tok-1" },
) {
	return http.post(`${BASE_URL}/graph/query`, () => {
		if (opts.loginCounter) opts.loginCounter.count++;
		const nowSeconds = Math.floor(Date.now() / 1000);
		return HttpResponse.json({
			data: {
				login: {
					id: opts.tokenId,
					refreshId: "refresh-xyz",
					expireTime: nowSeconds + 4 * 60 * 60,
				},
			},
		});
	});
}

function makeClient(storeId?: string) {
	return new FlowhubInternalClient({
		email: "user@example.com",
		password: "pw",
		baseUrl: BASE_URL,
		storeId,
	});
}

describe("ReportsResource", () => {
	it("listReports() queries /analytics/query with GetReports and parses the response", async () => {
		let capturedUrl = "";
		let capturedBody: Record<string, unknown> | undefined;
		server.use(
			loginHandler(),
			http.post(`${BASE_URL}/analytics/query`, async ({ request }) => {
				capturedUrl = request.url;
				capturedBody = (await request.json()) as Record<string, unknown>;
				return HttpResponse.json({
					data: {
						reports: [
							{
								reportId: "accounting",
								name: "Accounting",
								description: "Taxes, discounts, refunds",
								isCustom: false,
								isFavorite: false,
								reportTypeInfo: { type: "finance_accounting" },
								parameters: [
									{
										key: "start_date",
										type: "date",
										name: "Start Date",
										description: null,
										isHidden: false,
										isRequired: true,
										defaultValue: null,
										options: null,
									},
								],
							},
							{
								reportId: "custom-uuid-123",
								name: "My Custom Report",
								description: null,
								isCustom: true,
								isFavorite: true,
								reportTypeInfo: { type: "inventory" },
								parameters: [],
							},
						],
					},
				});
			}),
		);

		const client = makeClient();
		const reports = await client.reports.listReports();

		expect(capturedUrl).toContain("/analytics/query");
		expect(capturedBody?.operationName).toBe("GetReports");

		expect(reports).toHaveLength(2);
		expect(reports[0]).toMatchObject({
			reportId: "accounting",
			name: "Accounting",
			type: "finance_accounting",
			isCustom: false,
			isFavorite: false,
		});
		expect(reports[0]!.parameters[0]).toMatchObject({
			key: "start_date",
			type: "date",
			isRequired: true,
		});
		expect(reports[1]).toMatchObject({
			reportId: "custom-uuid-123",
			isCustom: true,
			isFavorite: true,
		});
	});

	it("downloads a report with correct path, auth header, and query params", async () => {
		let capturedAuth: string | null = null;
		let capturedUrl = "";
		server.use(
			loginHandler({ tokenId: "session-token-1" }),
			http.get(`${BASE_URL}/analytics/accounting`, ({ request }) => {
				capturedAuth = request.headers.get("authorization");
				capturedUrl = request.url;
				return new HttpResponse("col1,col2\nval1,val2\n", {
					status: 200,
					headers: { "Content-Type": "text/plain; charset=utf-8" },
				});
			}),
		);

		const client = makeClient();
		const result = await client.reports.downloadAccounting({
			start_date: "2026-05-01",
			end_date: "2026-05-11",
			store_id: "store-abc",
		});

		expect(capturedAuth).toBe("session-token-1");
		expect(capturedUrl).toContain("/analytics/accounting");
		expect(capturedUrl).toContain("start_date=2026-05-01");
		expect(capturedUrl).toContain("end_date=2026-05-11");
		expect(capturedUrl).toContain("store_id=store-abc");

		expect(result.data).toBeInstanceOf(Buffer);
		expect(result.data.toString("utf-8")).toBe("col1,col2\nval1,val2\n");
		expect(result.contentType).toBe("text/plain; charset=utf-8");
	});

	it("uses fallback filename when Content-Disposition is missing", async () => {
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/accounting`, () => {
				return new HttpResponse("data\n", { status: 200 });
			}),
		);

		const client = makeClient();
		const result = await client.reports.downloadAccounting({
			start_date: "2026-05-01",
			end_date: "2026-05-11",
		});

		expect(result.filename).toBe("accounting-2026-05-01-2026-05-11.csv");
	});

	it("uses single-date fallback filename when start_date equals end_date", async () => {
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/accounting`, () => {
				return new HttpResponse("data\n", { status: 200 });
			}),
		);

		const client = makeClient();
		const result = await client.reports.downloadAccounting({
			start_date: "2026-05-11",
			end_date: "2026-05-11",
		});

		expect(result.filename).toBe("accounting-2026-05-11.csv");
	});

	it("extracts filename from Content-Disposition header when present", async () => {
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/accounting`, () => {
				return new HttpResponse("data\n", {
					status: 200,
					headers: { "Content-Disposition": 'attachment; filename="custom-report.csv"' },
				});
			}),
		);

		const client = makeClient();
		const result = await client.reports.downloadAccounting({
			start_date: "2026-05-01",
			end_date: "2026-05-11",
		});

		expect(result.filename).toBe("custom-report.csv");
	});

	it("retries once on 401 by re-logging in", async () => {
		const loginCounter = { count: 0 };
		let downloadAttempts = 0;
		server.use(
			loginHandler({ tokenId: "fresh-token", loginCounter }),
			http.get(`${BASE_URL}/analytics/accounting`, ({ request }) => {
				downloadAttempts++;
				const auth = request.headers.get("authorization");
				if (downloadAttempts === 1) {
					return new HttpResponse("Unauthorized", { status: 401 });
				}
				expect(auth).toBe("fresh-token");
				return new HttpResponse("ok\n", { status: 200 });
			}),
		);

		const client = makeClient();
		const result = await client.reports.downloadAccounting({
			start_date: "2026-05-01",
			end_date: "2026-05-11",
		});

		expect(downloadAttempts).toBe(2);
		expect(loginCounter.count).toBe(2);
		expect(result.data.toString("utf-8")).toBe("ok\n");
	});

	it("does not retry a second time if the retry also 401s", async () => {
		const loginCounter = { count: 0 };
		let downloadAttempts = 0;
		server.use(
			loginHandler({ tokenId: "tok", loginCounter }),
			http.get(`${BASE_URL}/analytics/accounting`, () => {
				downloadAttempts++;
				return new HttpResponse("Unauthorized", { status: 401 });
			}),
		);

		const client = makeClient();
		await expect(
			client.reports.downloadAccounting({
				start_date: "2026-05-01",
				end_date: "2026-05-11",
			}),
		).rejects.toThrow(FlowhubAuthError);

		expect(downloadAttempts).toBe(2);
		expect(loginCounter.count).toBe(2);
	});

	it("uses default storeId from forStore() when params omit it", async () => {
		let capturedUrl = "";
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/accounting`, ({ request }) => {
				capturedUrl = request.url;
				return new HttpResponse("data\n", { status: 200 });
			}),
		);

		const client = makeClient().forStore("default-store-id");
		await client.reports.downloadAccounting({
			start_date: "2026-05-01",
			end_date: "2026-05-11",
		});

		expect(capturedUrl).toContain("store_id=default-store-id");
	});

	it("explicit store_id in params overrides the default", async () => {
		let capturedUrl = "";
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/accounting`, ({ request }) => {
				capturedUrl = request.url;
				return new HttpResponse("data\n", { status: 200 });
			}),
		);

		const client = makeClient("default-store-id");
		await client.reports.downloadAccounting({
			start_date: "2026-05-01",
			end_date: "2026-05-11",
			store_id: "override-store",
		});

		expect(capturedUrl).toContain("store_id=override-store");
		expect(capturedUrl).not.toContain("default-store-id");
	});

	it("downloadReport works with arbitrary report IDs", async () => {
		let capturedUrl = "";
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/inventory-snapshot`, ({ request }) => {
				capturedUrl = request.url;
				return new HttpResponse("snapshot data\n", { status: 200 });
			}),
		);

		const client = makeClient();
		const result = await client.reports.downloadReport("inventory-snapshot", {
			store_id: "store-1",
		});

		expect(capturedUrl).toContain("/analytics/inventory-snapshot");
		expect(capturedUrl).toContain("store_id=store-1");
		expect(result.data.toString("utf-8")).toBe("snapshot data\n");
		expect(result.filename).toBe("inventory-snapshot.csv");
	});

	it.each([
		["downloadInventoryActivity", "inventory-activity"],
		["downloadProductActivity", "product-activity"],
		["downloadDealsUsage", "deals-usage"],
		["downloadDealsFullDetails", "deals-full-details"],
	] as const)("%s hits /analytics/%s", async (method, reportId) => {
		let capturedUrl = "";
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/${reportId}`, ({ request }) => {
				capturedUrl = request.url;
				return new HttpResponse("col1,col2\nv1,v2\n", { status: 200 });
			}),
		);

		const client = makeClient();
		const result = await client.reports[method]({
			start_date: "2026-06-01",
			end_date: "2026-06-14",
			store_id: "store-xyz",
		});

		expect(capturedUrl).toContain(`/analytics/${reportId}`);
		expect(capturedUrl).toContain("start_date=2026-06-01");
		expect(capturedUrl).toContain("store_id=store-xyz");
		expect(result.data.toString("utf-8")).toBe("col1,col2\nv1,v2\n");
	});

	it("downloadReportRows parses the CSV into header + row objects", async () => {
		server.use(
			loginHandler(),
			http.get(`${BASE_URL}/analytics/budtender-performance`, () => {
				return new HttpResponse(
					'Budtender,AOV,UPT\n"Murtha, Mark","$12.00","1.7"\nTalia G,"$9.50","2.1"\n',
					{ status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } },
				);
			}),
		);

		const client = makeClient();
		const { columns, rows, filename } = await client.reports.downloadReportRows(
			"budtender-performance",
			{ start_date: "2026-06-01", end_date: "2026-06-17", store_id: "s1" },
		);

		expect(columns).toEqual(["Budtender", "AOV", "UPT"]);
		expect(rows).toEqual([
			{ Budtender: "Murtha, Mark", AOV: "$12.00", UPT: "1.7" },
			{ Budtender: "Talia G", AOV: "$9.50", UPT: "2.1" },
		]);
		expect(filename).toBe("budtender-performance-2026-06-01-2026-06-17.csv");
	});

	it("concurrent downloads share a single login", async () => {
		const loginCounter = { count: 0 };
		server.use(
			loginHandler({ tokenId: "shared-token", loginCounter }),
			http.get(`${BASE_URL}/analytics/accounting`, async () => {
				await new Promise((r) => setTimeout(r, 20));
				return new HttpResponse("ok\n", { status: 200 });
			}),
		);

		const client = makeClient();
		await Promise.all([
			client.reports.downloadAccounting({ start_date: "2026-05-01", end_date: "2026-05-11" }),
			client.reports.downloadAccounting({ start_date: "2026-05-01", end_date: "2026-05-11" }),
			client.reports.downloadAccounting({ start_date: "2026-05-01", end_date: "2026-05-11" }),
		]);

		expect(loginCounter.count).toBe(1);
	});
});

describe("FlowhubInternalClient", () => {
	it("throws if email is missing", () => {
		expect(() => new FlowhubInternalClient({ email: "", password: "pw" })).toThrow(
			/email is required/,
		);
	});

	it("throws if password is missing", () => {
		expect(() => new FlowhubInternalClient({ email: "u@x.co", password: "" })).toThrow(
			/password is required/,
		);
	});

	it("forStore returns a new instance scoped to the storeId", () => {
		const client = new FlowhubInternalClient({
			email: "u@x.co",
			password: "pw",
			baseUrl: BASE_URL,
		});
		const scoped = client.forStore("store-x");
		expect(scoped).not.toBe(client);
		expect(scoped.storeId).toBe("store-x");
		expect(client.storeId).toBeUndefined();
	});
});
