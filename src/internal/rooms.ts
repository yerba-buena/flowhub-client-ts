import { FlowhubAuthError } from "../errors.js";
import type { Room } from "./cash-management-types.js";
import type { InternalHttp } from "./http.js";
import type { SessionAuth } from "./session-auth.js";

const GET_ROOMS_QUERY = `
query GetRooms {
  rooms {
    id
    name
    isForSale
  }
}
`;

/**
 * Read-only access to Flowhub rooms — primarily for resolving room IDs
 * when creating or updating a drawer (drawers are scoped to one or more
 * rooms within a store).
 *
 * Retries once on 401 by invalidating the cached token.
 */
export class RoomsResource {
	constructor(
		private readonly http: InternalHttp,
		private readonly auth: SessionAuth,
	) {}

	async list(): Promise<Room[]> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ rooms: Room[] }>(
				{
					operationName: "GetRooms",
					variables: {},
					query: GET_ROOMS_QUERY,
				},
				token,
			),
		);
		return data.rooms;
	}

	private async withAuthRetry<T>(fn: (token: string) => Promise<T>): Promise<T> {
		const tryOnce = async () => {
			const token = await this.auth.getToken();
			return fn(token);
		};
		try {
			return await tryOnce();
		} catch (err) {
			if (err instanceof FlowhubAuthError) {
				this.auth.invalidate();
				return tryOnce();
			}
			throw err;
		}
	}
}
