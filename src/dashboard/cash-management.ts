import { FlowhubAuthError } from "../errors.js";
import type {
	CountRecord,
	CreateDrawerInput,
	Drawer,
	DrawerActivity,
	DrawerTip,
	ListActivityParams,
	ListDrawersParams,
	UpdateDrawerInput,
} from "./cash-management-types.js";
import type { DashboardHttp } from "./http.js";
import type { SessionAuth } from "./session-auth.js";

const DRAWER_FIELDS = `
fragment DrawerFields on Drawer {
  id
  name
  type
  openedAt
  closedAt
  dropTriggerBalance
  needsDrop
  rooms { id name }
  users { id email meta { firstName lastName } }
  counts {
    id
    drawerId
    openedAt
    openedByUser { id email meta { firstName lastName } }
    ClosedAt
    closedByUser { id email meta { firstName lastName } }
    openingCashBalance
    cashBalance
    closingCashBalance
    openingCounts {
      total
      notes
      denominations {
        pennies nickels dimes quarters
        ones twos fives tens twenties fifties hundreds
      }
    }
    closingCounts {
      total
      notes
      denominations {
        pennies nickels dimes quarters
        ones twos fives tens twenties fifties hundreds
      }
    }
    cashRevenue
    debitRevenue
    achRevenue
    giftCardRevenue
    debitBalance
    achBalance
    debitTipRevenue
    closingDebitBalance
    closingRevenue
    payins  { id total reason timestamp user_id balance_before balance_after }
    payouts { id total reason timestamp user_id balance_before balance_after }
    drops   { id total reason timestamp user_id balance_before balance_after }
    pops    { id total reason timestamp user_id balance_before balance_after }
    totalPaidIn
    totalPaidOut
    totalDropped
    totalRevenueSinceOpen
  }
}
`;

const GET_DRAWERS_QUERY = `
${DRAWER_FIELDS}
query GetDrawers($id: String, $hidden: Boolean, $orderBy: String, $orderDirection: String) {
  drawers(id: $id, hidden: $hidden, orderBy: $orderBy, orderDirection: $orderDirection) {
    ...DrawerFields
  }
}
`;

const GET_DRAWER_ACTIVITIES_QUERY = `
${DRAWER_FIELDS}
query GetDrawerActivities($id: String!, $startDate: String!, $endDate: String!) {
  drawerActivities(id: $id, startDate: $startDate, endDate: $endDate) {
    actionTimestamp
    action
    subaction
    employeeName
    snapshot { ...DrawerFields }
    changedValues {
      name        { to from }
      type        { to from }
      dropTriggerBalance { to from }
      rooms       { to { id name } from { id name } }
      users       { to { id email meta { firstName lastName } } from { id email meta { firstName lastName } } }
    }
  }
}
`;

const GET_DRAWER_TIPS_QUERY = `
query GetDrawerTips($drawerCountId: String!) {
  drawerTips(drawerCountId: $drawerCountId) {
    name
    amount
  }
}
`;

const CREATE_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation CreateDrawer(
  $name: String!
  $type: String!
  $rooms: [String!]!
  $dropTriggerBalance: Int!
) {
  createDrawer(
    name: $name
    type: $type
    rooms: $rooms
    dropTriggerBalance: $dropTriggerBalance
  ) {
    ...DrawerFields
  }
}
`;

const UPDATE_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation UpdateDrawer(
  $id: String!
  $name: String!
  $type: String!
  $rooms: [String!]!
  $dropTriggerBalance: Int!
) {
  updateDrawer(
    id: $id
    name: $name
    type: $type
    rooms: $rooms
    dropTriggerBalance: $dropTriggerBalance
  ) {
    ...DrawerFields
  }
}
`;

const DELETE_DRAWER_MUTATION = `
mutation DeleteDrawer($id: String!) {
  deleteDrawer(id: $id)
}
`;

const ADD_DRAWER_USER_MUTATION = `
${DRAWER_FIELDS}
mutation AddDrawerUser($drawerId: String!, $userId: String!) {
  addDrawerUser(drawerId: $drawerId, userId: $userId) {
    ...DrawerFields
  }
}
`;

const REMOVE_DRAWER_USER_MUTATION = `
${DRAWER_FIELDS}
mutation RemoveDrawerUser($drawerId: String!, $userId: String!) {
  removeDrawerUser(drawerId: $drawerId, userId: $userId) {
    ...DrawerFields
  }
}
`;

const OPEN_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation OpenDrawer($id: String!, $count: CountRecordInput!) {
  openDrawer(id: $id, count: $count) {
    ...DrawerFields
  }
}
`;

const CLOSE_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation CloseDrawer($id: String!, $count: CountRecordInput!) {
  closeDrawer(id: $id, count: $count) {
    ...DrawerFields
  }
}
`;

/**
 * Resource for Flowhub's cash-management surface: drawers, drawer counts,
 * drop / pop / pay-in / pay-out events, the activity feed, and tips.
 *
 * Phase 1 (this file) implements the read-only methods. Drawer CRUD,
 * lifecycle (open/close), and cash events come in later phases.
 *
 * All methods retry exactly once on 401 by invalidating the cached token
 * and re-logging in. If the retry also 401s, `FlowhubAuthError` propagates.
 */
export class DrawersResource {
	constructor(
		private readonly http: DashboardHttp,
		private readonly auth: SessionAuth,
	) {}

	/**
	 * List drawers. With no params, returns all drawers. Pass `hidden: false`
	 * to exclude soft-deleted drawers (matches what the dashboard's drawers
	 * page polls every ~5 seconds).
	 */
	async list(params: ListDrawersParams = {}): Promise<Drawer[]> {
		const variables: Record<string, unknown> = {};
		if (params.hidden !== undefined) variables.hidden = params.hidden;
		if (params.orderBy !== undefined) variables.orderBy = params.orderBy;
		if (params.orderDirection !== undefined) variables.orderDirection = params.orderDirection;

		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ drawers: Drawer[] }>(
				{
					operationName: "GetDrawers",
					variables,
					query: GET_DRAWERS_QUERY,
				},
				token,
			),
		);
		return data.drawers;
	}

	/**
	 * Fetch a single drawer by ID. Returns `null` if the server returns an
	 * empty list (the drawer doesn't exist or is hidden).
	 */
	async get(id: string): Promise<Drawer | null> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ drawers: Drawer[] }>(
				{
					operationName: "GetDrawers",
					variables: { id },
					query: GET_DRAWERS_QUERY,
				},
				token,
			),
		);
		return data.drawers[0] ?? null;
	}

	/**
	 * Audit feed for a single drawer over a date range. Includes create /
	 * update / open / close / drop / pop / payin / payout events with the
	 * full drawer snapshot at each point.
	 */
	async listActivity(drawerId: string, params: ListActivityParams): Promise<DrawerActivity[]> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ drawerActivities: DrawerActivity[] }>(
				{
					operationName: "GetDrawerActivities",
					variables: {
						id: drawerId,
						startDate: params.startDate,
						endDate: params.endDate,
					},
					query: GET_DRAWER_ACTIVITIES_QUERY,
				},
				token,
			),
		);
		return data.drawerActivities;
	}

	/**
	 * Tip totals associated with a particular drawer count (between an open
	 * and a close). Keyed by `drawerCountId`, NOT the drawer's own ID.
	 */
	async listTips(drawerCountId: string): Promise<DrawerTip[]> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ drawerTips: DrawerTip[] }>(
				{
					operationName: "GetDrawerTips",
					variables: { drawerCountId },
					query: GET_DRAWER_TIPS_QUERY,
				},
				token,
			),
		);
		return data.drawerTips;
	}

	/**
	 * Create a new drawer. `rooms` is a list of room UUIDs the drawer is
	 * scoped to; `dropTriggerBalance` is in integer cents. Returned drawer
	 * has `openedAt: null` and `counts: null` until `open()` is called.
	 */
	async create(input: CreateDrawerInput): Promise<Drawer> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ createDrawer: Drawer }>(
				{
					operationName: "CreateDrawer",
					variables: {
						name: input.name,
						type: input.type,
						rooms: input.rooms,
						dropTriggerBalance: input.dropTriggerBalance,
					},
					query: CREATE_DRAWER_MUTATION,
				},
				token,
			),
		);
		return data.createDrawer;
	}

	/**
	 * Update an existing drawer. Fires even on no-op edits — the server
	 * tolerates that. Note: this does NOT manage user assignment; use
	 * `assignUser` / `unassignUser` for that.
	 */
	async update(id: string, input: UpdateDrawerInput): Promise<Drawer> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ updateDrawer: Drawer }>(
				{
					operationName: "UpdateDrawer",
					variables: {
						id,
						name: input.name,
						type: input.type,
						rooms: input.rooms,
						dropTriggerBalance: input.dropTriggerBalance,
					},
					query: UPDATE_DRAWER_MUTATION,
				},
				token,
			),
		);
		return data.updateDrawer;
	}

	/**
	 * Delete a drawer. The server returns an empty array on success; this
	 * method normalises that to `void`. The drawer is soft-deleted (hidden)
	 * rather than physically removed.
	 */
	async delete(id: string): Promise<void> {
		await this.withAuthRetry((token) =>
			this.http.graphql<{ deleteDrawer: unknown }>(
				{
					operationName: "DeleteDrawer",
					variables: { id },
					query: DELETE_DRAWER_MUTATION,
				},
				token,
			),
		);
	}

	/**
	 * Assign a user to a drawer. Drawer↔user is many-to-many; calling this
	 * with an already-assigned user is a no-op on the server side.
	 */
	async assignUser(drawerId: string, userId: string): Promise<Drawer> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ addDrawerUser: Drawer }>(
				{
					operationName: "AddDrawerUser",
					variables: { drawerId, userId },
					query: ADD_DRAWER_USER_MUTATION,
				},
				token,
			),
		);
		return data.addDrawerUser;
	}

	/** Remove a user from a drawer. */
	async unassignUser(drawerId: string, userId: string): Promise<Drawer> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ removeDrawerUser: Drawer }>(
				{
					operationName: "RemoveDrawerUser",
					variables: { drawerId, userId },
					query: REMOVE_DRAWER_USER_MUTATION,
				},
				token,
			),
		);
		return data.removeDrawerUser;
	}

	/**
	 * Open a drawer with an opening count (cash on hand at the start of the
	 * shift). Sets `counts.openedAt`, `counts.openedByUser`, and
	 * `counts.openingCounts`. The drawer must currently be closed (or
	 * not-yet-opened) — opening an already-open drawer is rejected
	 * server-side.
	 */
	async open(id: string, count: CountRecord): Promise<Drawer> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ openDrawer: Drawer }>(
				{
					operationName: "OpenDrawer",
					variables: { id, count },
					query: OPEN_DRAWER_MUTATION,
				},
				token,
			),
		);
		return data.openDrawer;
	}

	/**
	 * Close a drawer with a closing count. Sets `counts.ClosedAt`
	 * (server-side capitalisation preserved), `counts.closedByUser`, and
	 * `counts.closingCounts`. The drawer must currently be open.
	 */
	async close(id: string, count: CountRecord): Promise<Drawer> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ closeDrawer: Drawer }>(
				{
					operationName: "CloseDrawer",
					variables: { id, count },
					query: CLOSE_DRAWER_MUTATION,
				},
				token,
			),
		);
		return data.closeDrawer;
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
