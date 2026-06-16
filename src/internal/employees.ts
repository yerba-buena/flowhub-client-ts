import { FlowhubAuthError } from "../errors.js";
import type {
	Employee,
	EmployeeRole,
	EmployeeStore,
	ListEmployeesParams,
} from "./employees-types.js";
import type { InternalHttp } from "./http.js";
import type { SessionAuth } from "./session-auth.js";

/**
 * Both the roster list and single-employee lookup hit the same `filteredUsers`
 * field; only the params differ. We select a minimal, roster-relevant subset of
 * the dashboard's full user payload — notably **excluding** the `apiKeys` block
 * (which contains secrets). `meta` is a JSON scalar (`{ firstName, lastName }`),
 * so it is selected bare rather than sub-selected.
 */
const FILTERED_USERS_FIELDS = `
    id
    email
    phoneNumber
    status
    isInternal
    activeStoreId
    meta
    roleId
    role { id name }
    stores { id name }
`;

const GET_ALL_USERS_QUERY = `
query GetAllUsers(
  $storeId: ID
  $search: String
  $status: UserStatus
  $roleId: ID
  $limit: Int
  $offset: Int
  $orderBy: UsersOrderBy
  $orderDirection: OrderDirection
) {
  users: filteredUsers(
    usersParams: {
      storeId: $storeId
      search: $search
      status: $status
      roleId: $roleId
      limit: $limit
      offset: $offset
      orderBy: $orderBy
      orderDirection: $orderDirection
    }
  ) {
${FILTERED_USERS_FIELDS}
  }
}
`;

const GET_ONE_USER_QUERY = `
query GetOneUser($id: ID) {
  users: filteredUsers(usersParams: { userId: $id, status: all }) {
${FILTERED_USERS_FIELDS}
  }
}
`;

/** Default page size when auto-paginating in `listAll()`. */
const LIST_ALL_PAGE_SIZE = 100;

interface RawUser {
	readonly id: string;
	readonly email: string;
	readonly phoneNumber: string | null;
	readonly status: string;
	readonly isInternal: boolean;
	readonly activeStoreId: string | null;
	readonly meta: { firstName?: string | null; lastName?: string | null } | null;
	readonly role: EmployeeRole | null;
	readonly stores: ReadonlyArray<EmployeeStore> | null;
}

function toEmployee(u: RawUser): Employee {
	const firstName = u.meta?.firstName ?? null;
	const lastName = u.meta?.lastName ?? null;
	const name = [firstName, lastName].filter(Boolean).join(" ").trim();
	const stores = u.stores ?? [];
	return {
		id: u.id,
		name,
		firstName,
		lastName,
		email: u.email,
		phoneNumber: u.phoneNumber ?? null,
		status: u.status,
		active: u.status === "active",
		isInternal: u.isInternal,
		activeStoreId: u.activeStoreId ?? null,
		role: u.role ?? null,
		storeIds: stores.map((s) => s.id),
		stores,
	};
}

/**
 * Read-only access to the Flowhub employee/staff roster, for resolving the
 * `email → id` mapping (where `id` is the seller's `budtenderId` on sales).
 *
 * Backed by the dashboard's internal `filteredUsers` GraphQL field; requires
 * dashboard credentials (not a public API key). Retries once on 401 by
 * invalidating the cached session token.
 */
export class EmployeesResource {
	constructor(
		private readonly http: InternalHttp,
		private readonly auth: SessionAuth,
		private readonly defaultStoreId: string | undefined,
	) {}

	/**
	 * List one page of employees. Defaults to `status: "active"` and applies the
	 * client's default `storeId` when one isn't passed. Pass `limit`/`offset` to
	 * paginate, or use {@link listAll} to fetch the entire roster.
	 */
	async list(params: ListEmployeesParams = {}): Promise<Employee[]> {
		const variables: Record<string, unknown> = {
			storeId: params.storeId ?? this.defaultStoreId,
			search: params.search ?? null,
			status: params.status ?? "active",
			roleId: params.roleId,
			limit: params.limit,
			offset: params.offset,
			orderBy: params.orderBy,
			orderDirection: params.orderDirection,
		};

		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ users: RawUser[] }>(
				{ operationName: "GetAllUsers", variables, query: GET_ALL_USERS_QUERY },
				token,
			),
		);
		return data.users.map(toEmployee);
	}

	/**
	 * Fetch the entire roster by auto-paginating `list()`. Useful for building an
	 * `email → employee` index in one call. `limit`/`offset` in `params` are
	 * ignored (pagination is managed internally).
	 */
	async listAll(params: Omit<ListEmployeesParams, "limit" | "offset"> = {}): Promise<Employee[]> {
		const all: Employee[] = [];
		let offset = 0;
		for (;;) {
			const page = await this.list({ ...params, limit: LIST_ALL_PAGE_SIZE, offset });
			all.push(...page);
			if (page.length < LIST_ALL_PAGE_SIZE) break;
			offset += LIST_ALL_PAGE_SIZE;
		}
		return all;
	}

	/** Fetch a single employee by their user UUID, or `null` if not found. */
	async get(id: string): Promise<Employee | null> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ users: RawUser[] }>(
				{ operationName: "GetOneUser", variables: { id }, query: GET_ONE_USER_QUERY },
				token,
			),
		);
		const user = data.users[0];
		return user ? toEmployee(user) : null;
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
