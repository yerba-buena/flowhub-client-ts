import { FlowhubAuthError } from "../errors.js";
import type { ListUsersParams, User } from "./cash-management-types.js";
import type { InternalHttp } from "./http.js";
import type { SessionAuth } from "./session-auth.js";

const GET_USERS_QUERY = `
query GetUsers(
  $storeUsers: Boolean
  $storeId: ID
  $status: UserStatus
  $orderBy: UsersOrderBy
  $storeIds: [ID]
  $isInternal: Boolean
) {
  users: filteredUsers(
    usersParams: {
      onSameStoreAsRequester: $storeUsers
      storeId: $storeId
      status: $status
      orderBy: $orderBy
      storeIds: $storeIds
      isInternal: $isInternal
    }
  ) {
    id
    email
    meta
    phoneNumber
    stores { id name }
    role { id name isHourly permissions { id name action target } }
  }
}
`;

/**
 * Read-only access to Flowhub users — primarily for resolving user IDs
 * when assigning users to drawers or attributing cash events.
 *
 * Retries once on 401 by invalidating the cached token.
 */
export class UsersResource {
	constructor(
		private readonly http: InternalHttp,
		private readonly auth: SessionAuth,
	) {}

	/**
	 * List users. Pass `storeUsers: true` to scope to users assigned to a
	 * store (the most common case when populating a "who performed this
	 * action" dropdown).
	 */
	async list(params: ListUsersParams = {}): Promise<User[]> {
		const variables: Record<string, unknown> = {};
		if (params.storeUsers !== undefined) variables.storeUsers = params.storeUsers;
		if (params.storeId !== undefined) variables.storeId = params.storeId;
		if (params.storeIds !== undefined) variables.storeIds = params.storeIds;
		if (params.status !== undefined) variables.status = params.status;
		if (params.orderBy !== undefined) variables.orderBy = params.orderBy;
		if (params.isInternal !== undefined) variables.isInternal = params.isInternal;

		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ users: User[] }>(
				{
					operationName: "GetUsers",
					variables,
					query: GET_USERS_QUERY,
				},
				token,
			),
		);
		return data.users;
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
