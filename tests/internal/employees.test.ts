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

function makeClient(storeId?: string) {
	return new FlowhubInternalClient({
		email: "user@example.com",
		password: "pw",
		baseUrl: BASE_URL,
		storeId,
	});
}

const RAW_USER = {
	id: "2a806c5b-9729-46b0-a8cd-bc290afb51ce",
	email: "alex@example.com",
	phoneNumber: "+15555555555",
	status: "active",
	isInternal: false,
	activeStoreId: "store-1",
	meta: { firstName: "Alex", lastName: "Cashier" },
	roleId: "role-1",
	role: { id: "role-1", name: "Budtender" },
	stores: [
		{ id: "store-1", name: "Main Street" },
		{ id: "store-2", name: "Second Ave" },
	],
};

describe("EmployeesResource", () => {
	it("maps filteredUsers into Employee shape (name, email, active, storeIds)", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetAllUsers: ({ variables }) => {
					capturedVars = variables;
					return { data: { users: [RAW_USER] } };
				},
			}),
		);

		const [emp] = await makeClient().employees.list();

		expect(emp).toMatchObject({
			id: "2a806c5b-9729-46b0-a8cd-bc290afb51ce",
			name: "Alex Cashier",
			firstName: "Alex",
			lastName: "Cashier",
			email: "alex@example.com",
			status: "active",
			active: true,
			role: { id: "role-1", name: "Budtender" },
			storeIds: ["store-1", "store-2"],
		});
		// defaults: status active, search null, no store override
		expect(capturedVars).toMatchObject({ status: "active", search: null });
	});

	it("defaults status to active and applies the client's default storeId", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetAllUsers: ({ variables }) => {
					capturedVars = variables;
					return { data: { users: [] } };
				},
			}),
		);

		await makeClient("default-store").employees.list();
		expect(capturedVars).toMatchObject({ storeId: "default-store", status: "active" });
	});

	it("explicit params override defaults", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetAllUsers: ({ variables }) => {
					capturedVars = variables;
					return { data: { users: [] } };
				},
			}),
		);

		await makeClient("default-store").employees.list({
			storeId: "other-store",
			status: "all",
			search: "alex",
			limit: 50,
			offset: 100,
			orderBy: "lastName",
			orderDirection: "desc",
		});
		expect(capturedVars).toMatchObject({
			storeId: "other-store",
			status: "all",
			search: "alex",
			limit: 50,
			offset: 100,
			orderBy: "lastName",
			orderDirection: "desc",
		});
	});

	it("listAll() auto-paginates until a short page", async () => {
		const offsets: number[] = [];
		// 100 on first page, 100 on second, 30 on third (short -> stop)
		const page = (n: number) =>
			Array.from({ length: n }, (_, i) => ({ ...RAW_USER, id: `u-${i}`, email: `u${i}@x.co` }));
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetAllUsers: ({ variables }) => {
					const offset = variables.offset as number;
					offsets.push(offset);
					const count = offset === 0 ? 100 : offset === 100 ? 100 : 30;
					return { data: { users: page(count) } };
				},
			}),
		);

		const all = await makeClient().employees.listAll();
		expect(all).toHaveLength(230);
		expect(offsets).toEqual([0, 100, 200]);
	});

	it("get() returns one employee or null", async () => {
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetOneUser: ({ variables }) =>
					variables.id === "missing" ? { data: { users: [] } } : { data: { users: [RAW_USER] } },
			}),
		);

		const client = makeClient();
		expect(await client.employees.get("2a806c5b-9729-46b0-a8cd-bc290afb51ce")).toMatchObject({
			email: "alex@example.com",
		});
		expect(await client.employees.get("missing")).toBeNull();
	});

	it("handles null meta / stores without throwing", async () => {
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetAllUsers: () => ({
					data: {
						users: [{ ...RAW_USER, meta: null, stores: null, role: null, phoneNumber: null }],
					},
				}),
			}),
		);

		const [emp] = await makeClient().employees.list();
		expect(emp).toMatchObject({
			name: "",
			firstName: null,
			lastName: null,
			role: null,
			storeIds: [],
			stores: [],
		});
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
				return HttpResponse.json({ data: { users: [RAW_USER] } });
			}),
		);

		const employees = await makeClient().employees.list();
		expect(employees[0]?.email).toBe("alex@example.com");
		expect(attempts).toBe(2);
		expect(loginCounter.count).toBe(2);
	});
});
