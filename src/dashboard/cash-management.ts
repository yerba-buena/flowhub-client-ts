import { FlowhubAuthError } from "../errors.js";
import type {
	Drawer,
	DrawerActivity,
	DrawerTip,
	ListActivityParams,
	ListDrawersParams,
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
