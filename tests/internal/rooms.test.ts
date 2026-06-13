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

describe("RoomsResource.list", () => {
	it("queries GetRooms with no variables and returns rooms", async () => {
		let operationName = "";
		let capturedVars: Record<string, unknown> | undefined;
		server.use(
			gqlRouter({
				Login: () => makeLoginPayload(),
				GetRooms: ({ variables }) => {
					operationName = "GetRooms";
					capturedVars = variables;
					return {
						data: {
							rooms: [
								{ id: "room-1", name: "Front", isForSale: true },
								{ id: "room-2", name: "Back", isForSale: false },
							],
						},
					};
				},
			}),
		);

		const client = makeClient();
		const rooms = await client.rooms.list();

		expect(operationName).toBe("GetRooms");
		expect(capturedVars).toEqual({});
		expect(rooms).toHaveLength(2);
		expect(rooms[0]).toEqual({ id: "room-1", name: "Front", isForSale: true });
	});
});
