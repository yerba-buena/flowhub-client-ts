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
			login: {
				id: tokenId,
				refreshId: "refresh-xyz",
				expireTime: nowSeconds + 4 * 60 * 60,
			},
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

const SAMPLE_USER = {
	id: "user-1",
	email: "alex@example.com",
	meta: { firstName: "Alex", lastName: "Cashier" },
	phoneNumber: "+15555555555",
	stores: [{ id: "store-1", name: "Main Street" }],
	role: { id: "role-1", name: "Manager", permissions: ["drawer.open", "drawer.close"] },
};

describe("UsersResource.list", () => {
	it("queries GetUsers with the supplied variables and returns users", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetUsers: ({ variables }) => {
					capturedVars = variables;
					return { data: { users: [SAMPLE_USER] } };
				},
			}),
		);

		const client = makeClient();
		const users = await client.users.list({ storeUsers: true, storeId: "store-1" });

		expect(capturedVars).toEqual({ storeUsers: true, storeId: "store-1" });
		expect(users).toHaveLength(1);
		expect(users[0]).toMatchObject({
			id: "user-1",
			email: "alex@example.com",
			role: { name: "Manager" },
		});
	});

	it("omits unset variables", async () => {
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetUsers: ({ variables }) => {
					capturedVars = variables;
					return { data: { users: [] } };
				},
			}),
		);

		const client = makeClient();
		await client.users.list();
		expect(capturedVars).toEqual({});
	});
});
