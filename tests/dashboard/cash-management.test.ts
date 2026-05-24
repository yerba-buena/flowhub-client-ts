import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { FlowhubDashboardClient } from "../../src/dashboard/client.js";
import { FlowhubAuthError } from "../../src/errors.js";

const DASHBOARD_URL = "https://api.flowhub.com";

const server = setupServer();

beforeAll(() => server.listen({ onUnhandledRequest: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeLoginPayload(tokenId = "tok-1") {
	const nowSeconds = Math.floor(Date.now() / 1000);
	return {
		data: {
			login: {
				id: tokenId,
				refreshId: "refresh-xyz",
				expireTime: nowSeconds + 4 * 60 * 60,
			},
		},
	};
}

type GqlHandlerArgs = {
	variables: Record<string, unknown>;
	headers: Headers;
	url: string;
};
type GqlHandlerResult = Record<string, unknown> | Response;
type GqlRoutes = Record<string, ((args: GqlHandlerArgs) => GqlHandlerResult) | undefined>;

/**
 * Routes a single MSW handler on /graph/query based on the GraphQL
 * `operationName` in the request body.
 */
function gqlRouter(routes: GqlRoutes) {
	return http.post(`${DASHBOARD_URL}/graph/query`, async ({ request }) => {
		const body = (await request.json()) as {
			operationName: string;
			variables: Record<string, unknown>;
		};
		const handler = routes[body.operationName];
		if (!handler) {
			return new HttpResponse(`No handler for ${body.operationName}`, { status: 500 });
		}
		const result = handler({
			variables: body.variables,
			headers: request.headers,
			url: request.url,
		});
		if (result instanceof Response) return result;
		return HttpResponse.json(result);
	});
}

function makeClient() {
	return new FlowhubDashboardClient({
		email: "user@example.com",
		password: "pw",
		baseUrl: DASHBOARD_URL,
	});
}

const SAMPLE_DRAWER = {
	id: "drawer-uuid-1",
	name: "Test Drawer",
	type: "REC",
	openedAt: "2026-05-24T09:00:00Z",
	closedAt: null,
	dropTriggerBalance: 100000,
	needsDrop: false,
	rooms: [{ id: "room-1", name: "Front" }],
	users: [
		{
			id: "user-1",
			email: "cashier@example.com",
			meta: { firstName: "Alex", lastName: "Cashier" },
		},
	],
	counts: {
		id: "count-1",
		drawerId: "drawer-uuid-1",
		openedAt: "2026-05-24T09:00:00Z",
		openedByUser: {
			id: "user-1",
			email: "cashier@example.com",
			meta: { firstName: "Alex", lastName: "Cashier" },
		},
		ClosedAt: null,
		closedByUser: null,
		openingCashBalance: 30000,
		cashBalance: 30000,
		closingCashBalance: 0,
		openingCounts: {
			total: 30000,
			notes: "",
			denominations: {
				pennies: 0,
				nickels: 0,
				dimes: 0,
				quarters: 0,
				ones: 100,
				twos: 0,
				fives: 20,
				tens: 5,
				twenties: 5,
				fifties: 0,
				hundreds: 0,
			},
		},
		closingCounts: null,
		cashRevenue: 0,
		debitRevenue: 0,
		achRevenue: 0,
		giftCardRevenue: 0,
		debitBalance: 0,
		achBalance: 0,
		debitTipRevenue: 0,
		closingDebitBalance: 0,
		closingRevenue: 0,
		payins: [],
		payouts: [],
		drops: [],
		pops: [],
		totalPaidIn: 0,
		totalPaidOut: 0,
		totalDropped: 0,
		totalRevenueSinceOpen: 0,
	},
};

describe("DrawersResource.list", () => {
	it("queries GetDrawers with the given variables and returns the drawers", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawers: ({ variables }) => {
					capturedVars = variables;
					return { data: { drawers: [SAMPLE_DRAWER] } };
				},
			}),
		);

		const client = makeClient();
		const drawers = await client.drawers.list({
			hidden: false,
			orderBy: "name",
			orderDirection: "asc",
		});

		expect(capturedVars).toEqual({ hidden: false, orderBy: "name", orderDirection: "asc" });
		expect(drawers).toHaveLength(1);
		expect(drawers[0]).toMatchObject({ id: "drawer-uuid-1", name: "Test Drawer", type: "REC" });
	});

	it("passes no variables when called with no params", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawers: ({ variables }) => {
					capturedVars = variables;
					return { data: { drawers: [] } };
				},
			}),
		);

		const client = makeClient();
		await client.drawers.list();

		expect(capturedVars).toEqual({});
	});

	it("preserves the server's snake_case in cash event arrays and capitalised ClosedAt", async () => {
		const drawerWithEvent = {
			...SAMPLE_DRAWER,
			counts: {
				...SAMPLE_DRAWER.counts,
				ClosedAt: "2026-05-24T17:00:00Z",
				payins: [
					{
						id: "ev-1",
						total: 5000,
						reason: "change top-up",
						timestamp: "2026-05-24T11:00:00.123456789Z",
						user_id: "user-1",
						balance_before: 30000,
						balance_after: 35000,
					},
				],
			},
		};
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawers: () => ({ data: { drawers: [drawerWithEvent] } }),
			}),
		);

		const client = makeClient();
		const drawers = await client.drawers.list();
		const counts = drawers[0]?.counts;
		expect(counts?.ClosedAt).toBe("2026-05-24T17:00:00Z");
		expect(counts?.payins?.[0]).toMatchObject({
			user_id: "user-1",
			balance_before: 30000,
			balance_after: 35000,
		});
	});

	it("sends the Authorization header with the session token", async () => {
		let capturedAuth: string | null = null;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload("session-token-xyz"),
				GetDrawers: ({ headers }) => {
					capturedAuth = headers.get("authorization");
					return { data: { drawers: [] } };
				},
			}),
		);

		const client = makeClient();
		await client.drawers.list();
		expect(capturedAuth).toBe("session-token-xyz");
	});
});

describe("DrawersResource.get", () => {
	it("queries GetDrawers with { id } and returns the first drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawers: ({ variables }) => {
					capturedVars = variables;
					return { data: { drawers: [SAMPLE_DRAWER] } };
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.get("drawer-uuid-1");

		expect(capturedVars).toEqual({ id: "drawer-uuid-1" });
		expect(drawer?.id).toBe("drawer-uuid-1");
	});

	it("returns null when the server returns an empty list", async () => {
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawers: () => ({ data: { drawers: [] } }),
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.get("drawer-uuid-missing");
		expect(drawer).toBeNull();
	});
});

describe("DrawersResource.listActivity", () => {
	it("queries GetDrawerActivities with id + date range and returns activities", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		const activity = {
			actionTimestamp: "2026-05-24T09:00:00Z",
			action: "create",
			subaction: null,
			employeeName: "Alex Cashier",
			snapshot: SAMPLE_DRAWER,
			changedValues: null,
		};
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawerActivities: ({ variables }) => {
					capturedVars = variables;
					return { data: { drawerActivities: [activity] } };
				},
			}),
		);

		const client = makeClient();
		const activities = await client.drawers.listActivity("drawer-uuid-1", {
			startDate: "2026-05-01",
			endDate: "2026-05-24",
		});

		expect(capturedVars).toEqual({
			id: "drawer-uuid-1",
			startDate: "2026-05-01",
			endDate: "2026-05-24",
		});
		expect(activities).toHaveLength(1);
		expect(activities[0]?.action).toBe("create");
	});
});

describe("DrawersResource.listTips", () => {
	it("queries GetDrawerTips keyed on drawerCountId", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawerTips: ({ variables }) => {
					capturedVars = variables;
					return { data: { drawerTips: [{ name: "Cash Tips", amount: 1234 }] } };
				},
			}),
		);

		const client = makeClient();
		const tips = await client.drawers.listTips("count-1");

		expect(capturedVars).toEqual({ drawerCountId: "count-1" });
		expect(tips).toEqual([{ name: "Cash Tips", amount: 1234 }]);
	});
});

describe("DrawersResource auth retry", () => {
	it("retries once on FlowhubAuthError by invalidating and re-logging in", async () => {
		const loginTokens = ["tok-stale", "tok-fresh"];
		let getDrawersAttempts = 0;
		let loginCount = 0;
		server.use(
			gqlRouter({
				Login: () => {
					loginCount++;
					return makeLoginPayload(loginTokens.shift() ?? "tok-fresh");
				},
				GetDrawers: ({ headers }) => {
					getDrawersAttempts++;
					const auth = headers.get("authorization");
					if (getDrawersAttempts === 1) {
						expect(auth).toBe("tok-stale");
						return new HttpResponse("Unauthorized", { status: 401 });
					}
					expect(auth).toBe("tok-fresh");
					return { data: { drawers: [] } };
				},
			}),
		);

		const client = makeClient();
		const drawers = await client.drawers.list();
		expect(drawers).toEqual([]);
		expect(getDrawersAttempts).toBe(2);
		expect(loginCount).toBe(2);
	});

	it("does not retry a second time if the retry also returns 401", async () => {
		let getDrawersAttempts = 0;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetDrawers: () => {
					getDrawersAttempts++;
					return new HttpResponse("Unauthorized", { status: 401 });
				},
			}),
		);

		const client = makeClient();
		await expect(client.drawers.list()).rejects.toThrow(FlowhubAuthError);
		expect(getDrawersAttempts).toBe(2);
	});
});
