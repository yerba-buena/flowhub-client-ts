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
	return http.post(`${BASE_URL}/graph/query`, async ({ request }) => {
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
	return new FlowhubInternalClient({
		email: "user@example.com",
		password: "pw",
		baseUrl: BASE_URL,
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

describe("DrawersResource.create", () => {
	it("calls CreateDrawer with the supplied variables and returns the new drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				CreateDrawer: ({ variables }) => {
					capturedVars = variables;
					return {
						data: {
							createDrawer: {
								...SAMPLE_DRAWER,
								id: "new-drawer-uuid",
								name: "Register 2",
								openedAt: null,
								closedAt: null,
								counts: null,
							},
						},
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.create({
			name: "Register 2",
			type: "REC",
			rooms: ["room-1", "room-2"],
			dropTriggerBalance: 100000,
		});

		expect(capturedVars).toEqual({
			name: "Register 2",
			type: "REC",
			rooms: ["room-1", "room-2"],
			dropTriggerBalance: 100000,
		});
		expect(drawer.id).toBe("new-drawer-uuid");
		expect(drawer.counts).toBeNull();
	});
});

describe("DrawersResource.update", () => {
	it("calls UpdateDrawer with id + input variables and returns the updated drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				UpdateDrawer: ({ variables }) => {
					capturedVars = variables;
					return {
						data: {
							updateDrawer: { ...SAMPLE_DRAWER, name: "Renamed Drawer" },
						},
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.update("drawer-uuid-1", {
			name: "Renamed Drawer",
			type: "REC",
			rooms: ["room-1"],
			dropTriggerBalance: 150000,
		});

		expect(capturedVars).toEqual({
			id: "drawer-uuid-1",
			name: "Renamed Drawer",
			type: "REC",
			rooms: ["room-1"],
			dropTriggerBalance: 150000,
		});
		expect(drawer.name).toBe("Renamed Drawer");
	});
});

describe("DrawersResource.delete", () => {
	it("calls DeleteDrawer with the id and resolves to void on the empty-array success response", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				DeleteDrawer: ({ variables }) => {
					capturedVars = variables;
					return { data: { deleteDrawer: [] } };
				},
			}),
		);

		const client = makeClient();
		const result = await client.drawers.delete("drawer-uuid-1");

		expect(capturedVars).toEqual({ id: "drawer-uuid-1" });
		expect(result).toBeUndefined();
	});

	it("propagates a GraphQL error if the server rejects the delete", async () => {
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				DeleteDrawer: () =>
					HttpResponse.json({
						errors: [{ message: "drawer not found" }],
					}) as Response,
			}),
		);

		const client = makeClient();
		await expect(client.drawers.delete("nope")).rejects.toThrow(/drawer not found/);
	});
});

describe("DrawersResource user assignment", () => {
	it("assignUser calls AddDrawerUser and returns the updated drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		const updated = {
			...SAMPLE_DRAWER,
			users: [
				...SAMPLE_DRAWER.users,
				{
					id: "user-2",
					email: "second@example.com",
					meta: { firstName: "Sam", lastName: "Second" },
				},
			],
		};
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				AddDrawerUser: ({ variables }) => {
					capturedVars = variables;
					return { data: { addDrawerUser: updated } };
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.assignUser("drawer-uuid-1", "user-2");

		expect(capturedVars).toEqual({ drawerId: "drawer-uuid-1", userId: "user-2" });
		expect(drawer.users.map((u) => u.id)).toContain("user-2");
	});

	it("unassignUser calls RemoveDrawerUser and returns the updated drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				RemoveDrawerUser: ({ variables }) => {
					capturedVars = variables;
					return {
						data: { removeDrawerUser: { ...SAMPLE_DRAWER, users: [] } },
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.unassignUser("drawer-uuid-1", "user-1");

		expect(capturedVars).toEqual({ drawerId: "drawer-uuid-1", userId: "user-1" });
		expect(drawer.users).toEqual([]);
	});
});

describe("DrawersResource.open", () => {
	it("calls OpenDrawer with id + count and returns the opened drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		const openingCount = {
			total: 30000,
			notes: "Opening shift",
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
		};
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				OpenDrawer: ({ variables }) => {
					capturedVars = variables;
					return {
						data: {
							openDrawer: {
								...SAMPLE_DRAWER,
								openedAt: "2026-05-24T09:00:00Z",
							},
						},
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.open("drawer-uuid-1", openingCount);

		expect(capturedVars).toEqual({ id: "drawer-uuid-1", count: openingCount });
		expect(drawer.openedAt).toBe("2026-05-24T09:00:00Z");
	});
});

describe("DrawersResource.close", () => {
	it("calls CloseDrawer with id + count and returns the closed drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		const closingCount = {
			total: 35000,
			notes: "Closing shift",
			denominations: {
				pennies: 0,
				nickels: 0,
				dimes: 0,
				quarters: 0,
				ones: 150,
				twos: 0,
				fives: 20,
				tens: 5,
				twenties: 5,
				fifties: 0,
				hundreds: 0,
			},
		};
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				CloseDrawer: ({ variables }) => {
					capturedVars = variables;
					return {
						data: {
							closeDrawer: {
								...SAMPLE_DRAWER,
								closedAt: "2026-05-24T17:00:00Z",
								counts: {
									...SAMPLE_DRAWER.counts,
									ClosedAt: "2026-05-24T17:00:00Z",
									closingCounts: closingCount,
									closingCashBalance: 35000,
								},
							},
						},
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.close("drawer-uuid-1", closingCount);

		expect(capturedVars).toEqual({ id: "drawer-uuid-1", count: closingCount });
		expect(drawer.closedAt).toBe("2026-05-24T17:00:00Z");
		expect(drawer.counts?.ClosedAt).toBe("2026-05-24T17:00:00Z");
		expect(drawer.counts?.closingCashBalance).toBe(35000);
	});
});

describe("DrawersResource cash events", () => {
	const eventParams = { total: 5000, reason: "test", userId: "user-1" };
	const eventPayload = {
		id: "ev-1",
		total: 5000,
		reason: "test",
		timestamp: "2026-05-24T11:00:00.123Z",
		user_id: "user-1",
		balance_before: 30000,
		balance_after: 35000,
	};

	it("payIn calls MakePayin with { drawerId, payin } and returns the updated drawer", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				MakePayin: ({ variables }) => {
					capturedVars = variables;
					return {
						data: {
							makePayin: {
								...SAMPLE_DRAWER,
								counts: {
									...SAMPLE_DRAWER.counts,
									cashBalance: 35000,
									payins: [eventPayload],
									totalPaidIn: 5000,
								},
							},
						},
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.payIn("drawer-uuid-1", eventParams);

		expect(capturedVars).toEqual({ drawerId: "drawer-uuid-1", payin: eventParams });
		expect(drawer.counts?.payins).toHaveLength(1);
		expect(drawer.counts?.payins?.[0]?.balance_after).toBe(35000);
		expect(drawer.counts?.totalPaidIn).toBe(5000);
	});

	it("payOut calls MakePayout with { drawerId, payout }", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				MakePayout: ({ variables }) => {
					capturedVars = variables;
					return { data: { makePayout: SAMPLE_DRAWER } };
				},
			}),
		);

		const client = makeClient();
		await client.drawers.payOut("drawer-uuid-1", eventParams);
		expect(capturedVars).toEqual({ drawerId: "drawer-uuid-1", payout: eventParams });
	});

	it("drop calls MakeDrop with { drawerId, drop }", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				MakeDrop: ({ variables }) => {
					capturedVars = variables;
					return { data: { makeDrop: SAMPLE_DRAWER } };
				},
			}),
		);

		const client = makeClient();
		await client.drawers.drop("drawer-uuid-1", eventParams);
		expect(capturedVars).toEqual({ drawerId: "drawer-uuid-1", drop: eventParams });
	});

	it("pop calls MakePop with { drawerId, pop } and tolerates total: 0", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		const popParams = { total: 0, reason: "no-sale audit", userId: "user-1" };
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				MakePop: ({ variables }) => {
					capturedVars = variables;
					return {
						data: {
							makePop: {
								...SAMPLE_DRAWER,
								counts: {
									...SAMPLE_DRAWER.counts,
									pops: [{ ...eventPayload, total: 0, balance_after: 30000 }],
								},
							},
						},
					};
				},
			}),
		);

		const client = makeClient();
		const drawer = await client.drawers.pop("drawer-uuid-1", popParams);
		expect(capturedVars).toEqual({ drawerId: "drawer-uuid-1", pop: popParams });
		expect(drawer.counts?.pops).toHaveLength(1);
		expect(drawer.counts?.pops?.[0]?.total).toBe(0);
	});
});

describe("DrawersResource receipts", () => {
	describe("buildReceiptUrl", () => {
		it("builds the open / close URL with no eventId", () => {
			const client = makeClient();
			expect(client.drawers.buildReceiptUrl({ drawerCountId: "c-1", kind: "open" })).toBe(
				`${BASE_URL}/printing/drawer/c-1/open`,
			);
			expect(client.drawers.buildReceiptUrl({ drawerCountId: "c-1", kind: "close" })).toBe(
				`${BASE_URL}/printing/drawer/c-1/close`,
			);
		});

		it("builds the drop / pop / payin / payout URL with an eventId", () => {
			const client = makeClient();
			for (const kind of ["drop", "pop", "payin", "payout"] as const) {
				expect(
					client.drawers.buildReceiptUrl({
						drawerCountId: "c-1",
						kind,
						eventId: "ev-9",
					}),
				).toBe(`${BASE_URL}/printing/drawer/c-1/${kind}/ev-9`);
			}
		});

		it("throws if eventId is missing for drop / pop / payin / payout", () => {
			const client = makeClient();
			for (const kind of ["drop", "pop", "payin", "payout"] as const) {
				expect(() => client.drawers.buildReceiptUrl({ drawerCountId: "c-1", kind })).toThrow(
					/require an eventId/,
				);
			}
		});

		it("throws if eventId is supplied for open / close", () => {
			const client = makeClient();
			expect(() =>
				client.drawers.buildReceiptUrl({
					drawerCountId: "c-1",
					kind: "open",
					eventId: "ev-9",
				}),
			).toThrow(/must NOT include an eventId/);
		});
	});

	describe("downloadReceipt", () => {
		it("GETs the receipt path with Accept: application/pdf and returns bytes + contentType", async () => {
			let capturedAuth: string | null = null;
			let capturedAccept: string | null = null;
			let capturedUrl = "";
			const pdfBytes = Buffer.from("%PDF-1.4 test\n", "utf-8");
			server.use(
				gqlRouter({
					Login: () => makeLoginPayload("session-tok"),
				}),
				http.get(`${BASE_URL}/printing/drawer/c-1/open`, ({ request }) => {
					capturedAuth = request.headers.get("authorization");
					capturedAccept = request.headers.get("accept");
					capturedUrl = request.url;
					return new HttpResponse(pdfBytes, {
						status: 200,
						headers: {
							"Content-Type": "application/pdf",
							"Content-Disposition": 'attachment; filename="drawer-c-1-open.pdf"',
						},
					});
				}),
			);

			const client = makeClient();
			const result = await client.drawers.downloadReceipt({
				drawerCountId: "c-1",
				kind: "open",
			});

			expect(capturedAuth).toBe("session-tok");
			expect(capturedAccept).toBe("application/pdf");
			expect(capturedUrl).toBe(`${BASE_URL}/printing/drawer/c-1/open`);
			expect(result.contentType).toBe("application/pdf");
			expect(result.filename).toBe("drawer-c-1-open.pdf");
			expect(result.data.toString("utf-8")).toBe("%PDF-1.4 test\n");
		});

		it("retries once on 401 by re-logging in", async () => {
			let attempts = 0;
			const tokens = ["tok-stale", "tok-fresh"];
			let loginCount = 0;
			server.use(
				gqlRouter({
					Login: () => {
						loginCount++;
						return makeLoginPayload(tokens.shift() ?? "tok-fresh");
					},
				}),
				http.get(`${BASE_URL}/printing/drawer/c-1/close`, ({ request }) => {
					attempts++;
					const auth = request.headers.get("authorization");
					if (attempts === 1) {
						expect(auth).toBe("tok-stale");
						return new HttpResponse("Unauthorized", { status: 401 });
					}
					expect(auth).toBe("tok-fresh");
					return new HttpResponse(Buffer.from("ok"), { status: 200 });
				}),
			);

			const client = makeClient();
			const result = await client.drawers.downloadReceipt({
				drawerCountId: "c-1",
				kind: "close",
			});

			expect(attempts).toBe(2);
			expect(loginCount).toBe(2);
			expect(result.data.toString("utf-8")).toBe("ok");
		});

		it("propagates non-auth errors without retry", async () => {
			let attempts = 0;
			server.use(
				gqlRouter({ Login: () => makeLoginPayload() }),
				http.get(`${BASE_URL}/printing/drawer/c-1/drop/ev-9`, () => {
					attempts++;
					return new HttpResponse("Not Found", { status: 404 });
				}),
			);

			const client = makeClient();
			await expect(
				client.drawers.downloadReceipt({
					drawerCountId: "c-1",
					kind: "drop",
					eventId: "ev-9",
				}),
			).rejects.toThrow();
			expect(attempts).toBe(1);
		});
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
