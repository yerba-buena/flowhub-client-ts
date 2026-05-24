/**
 * Types for the cash-management resource.
 *
 * Shape mirrors what the Flowhub dashboard's GraphQL endpoint returns for
 * `GetDrawers`, `GetDrawerActivities`, and `GetDrawerTips`. Several server-side
 * quirks are preserved here rather than normalised away:
 *
 * - **Money is integer cents throughout.** $300 → 30000. Documented per field.
 * - **`DrawerCounts.ClosedAt`** is capitalised — server-side spelling quirk.
 * - **CashEvent uses snake_case** (`balance_before`, `balance_after`, `user_id`)
 *   while the rest of the response is camelCase. Preserved verbatim so the
 *   shapes match the wire format.
 * - **Drawer state is derived, not enum'd.** A drawer is not-yet-opened when
 *   `openedAt == null`, open when `openedAt != null && closedAt == null`,
 *   and closed when `closedAt != null`.
 * - **All entity IDs are UUIDs** (typed as `string`).
 * - **Timestamps are ISO 8601 strings.** Event timestamps include nanosecond
 *   precision.
 */

/** Observed values are `REC` (recreational) and `MED` (medical). */
export type DrawerType = "REC" | "MED";

export interface Room {
	readonly id: string;
	readonly name: string;
	readonly isForSale: boolean;
}

export interface DrawerRoom {
	readonly id: string;
	readonly name: string;
}

export interface DrawerUserMeta {
	readonly firstName: string;
	readonly lastName: string;
}

export interface DrawerUser {
	readonly id: string;
	readonly email: string;
	readonly meta: DrawerUserMeta;
}

export interface UserRole {
	readonly id: string;
	readonly name: string;
	readonly permissions: ReadonlyArray<string>;
}

export interface UserStore {
	readonly id: string;
	readonly name: string;
}

export interface User {
	readonly id: string;
	readonly email: string;
	readonly meta: DrawerUserMeta;
	readonly phoneNumber: string | null;
	readonly stores: ReadonlyArray<UserStore>;
	readonly role: UserRole | null;
}

export interface Denominations {
	readonly pennies: number | null;
	readonly nickels: number | null;
	readonly dimes: number | null;
	readonly quarters: number | null;
	readonly ones: number | null;
	readonly twos: number | null;
	readonly fives: number | null;
	readonly tens: number | null;
	readonly twenties: number | null;
	readonly fifties: number | null;
	readonly hundreds: number | null;
}

export interface CountRecord {
	/** cents */
	readonly total: number;
	readonly notes: string;
	readonly denominations: Denominations;
}

/**
 * A single drop / pop / pay-in / pay-out event appended to one of the four
 * arrays on `DrawerCounts`. Field naming is snake_case to match the wire
 * format — the rest of the response is camelCase.
 */
export interface CashEvent {
	readonly id: string;
	/** cents */
	readonly total: number;
	readonly reason: string;
	/** ISO 8601 with nanosecond precision. */
	readonly timestamp: string;
	readonly user_id: string;
	/** cents */
	readonly balance_before: number;
	/** cents */
	readonly balance_after: number;
}

export interface DrawerCounts {
	readonly id: string;
	readonly drawerId: string;
	readonly openedAt: string | null;
	readonly openedByUser: DrawerUser | null;
	/** Capitalised on the server — preserved as-is. */
	readonly ClosedAt: string | null;
	readonly closedByUser: DrawerUser | null;
	/** cents */
	readonly openingCashBalance: number;
	/** cents */
	readonly cashBalance: number;
	/** cents */
	readonly closingCashBalance: number;
	readonly openingCounts: CountRecord | null;
	readonly closingCounts: CountRecord | null;
	/** cents */
	readonly cashRevenue: number;
	/** cents */
	readonly debitRevenue: number;
	/** cents */
	readonly achRevenue: number;
	/** cents */
	readonly giftCardRevenue: number;
	/** cents */
	readonly debitBalance: number;
	/** cents */
	readonly achBalance: number;
	/** cents */
	readonly debitTipRevenue: number;
	/** cents */
	readonly closingDebitBalance: number;
	/** cents */
	readonly closingRevenue: number;
	readonly payins: ReadonlyArray<CashEvent> | null;
	readonly payouts: ReadonlyArray<CashEvent> | null;
	readonly drops: ReadonlyArray<CashEvent> | null;
	readonly pops: ReadonlyArray<CashEvent> | null;
	/** cents */
	readonly totalPaidIn: number;
	/** cents */
	readonly totalPaidOut: number;
	/** cents */
	readonly totalDropped: number;
	/** cents */
	readonly totalRevenueSinceOpen: number;
}

export interface Drawer {
	readonly id: string;
	readonly name: string;
	readonly type: DrawerType | string;
	readonly openedAt: string | null;
	readonly closedAt: string | null;
	/** cents — when `cashBalance` exceeds this, `needsDrop` flips true. */
	readonly dropTriggerBalance: number;
	readonly needsDrop: boolean;
	readonly rooms: ReadonlyArray<DrawerRoom>;
	readonly users: ReadonlyArray<DrawerUser>;
	readonly counts: DrawerCounts | null;
}

/**
 * Captured `action` values so far: `create`, `update`. Open/close and the four
 * cash events almost certainly land here too with their own values — left as a
 * permissive string union until empirically confirmed.
 */
export type DrawerActivityAction =
	| "create"
	| "update"
	| "open"
	| "close"
	| "drop"
	| "pop"
	| "payin"
	| "payout"
	| (string & {});

export interface DrawerActivityUsersChange {
	readonly to: ReadonlyArray<DrawerUser>;
	readonly from: ReadonlyArray<DrawerUser>;
}

export interface DrawerActivityChanges {
	readonly name?: { readonly to: string; readonly from: string } | null;
	readonly type?: { readonly to: string; readonly from: string } | null;
	readonly dropTriggerBalance?: { readonly to: number; readonly from: number } | null;
	readonly rooms?: {
		readonly to: ReadonlyArray<DrawerRoom>;
		readonly from: ReadonlyArray<DrawerRoom>;
	} | null;
	readonly users?: DrawerActivityUsersChange | null;
	readonly counts?: unknown | null;
}

export interface DrawerActivity {
	readonly actionTimestamp: string;
	readonly action: DrawerActivityAction;
	readonly subaction: string | null;
	readonly employeeName: string;
	readonly snapshot: Drawer;
	readonly changedValues: DrawerActivityChanges | null;
}

export interface DrawerTip {
	readonly name: string;
	/** cents */
	readonly amount: number;
}

export interface ListDrawersParams {
	readonly hidden?: boolean;
	readonly orderBy?: string;
	readonly orderDirection?: "asc" | "desc";
}

export interface ListActivityParams {
	/** YYYY-MM-DD */
	readonly startDate: string;
	/** YYYY-MM-DD */
	readonly endDate: string;
}

export interface ListUsersParams {
	readonly storeUsers?: boolean;
	readonly storeId?: string;
	readonly storeIds?: ReadonlyArray<string>;
	readonly status?: string;
	readonly orderBy?: string;
	readonly isInternal?: boolean;
}

export interface CreateDrawerInput {
	readonly name: string;
	readonly type: DrawerType | string;
	/** Room UUIDs the drawer is scoped to. At least one. */
	readonly rooms: ReadonlyArray<string>;
	/** cents */
	readonly dropTriggerBalance: number;
}

export interface UpdateDrawerInput {
	readonly name: string;
	readonly type: DrawerType | string;
	readonly rooms: ReadonlyArray<string>;
	/** cents */
	readonly dropTriggerBalance: number;
}

/**
 * Shared shape for all four cash-event mutations (drop, pop, pay-in,
 * pay-out). Server-side variable wrappers differ (`drop:` vs `payin:` etc.)
 * but the inner payload is identical.
 */
export interface CashEventParams {
	/** cents — for `pop` this is typically 0 (audit-only). */
	readonly total: number;
	readonly reason: string;
	/** UUID of the user performing the action. */
	readonly userId: string;
}
