export { F as FlowhubAuthError, a as FlowhubError, b as FlowhubNotFoundError, c as FlowhubRateLimitError, d as FlowhubValidationError } from '../errors-CktRSCIZ.js';

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
type DrawerType = "REC" | "MED";
interface Room {
    readonly id: string;
    readonly name: string;
    readonly isForSale: boolean;
}
interface DrawerRoom {
    readonly id: string;
    readonly name: string;
}
interface DrawerUserMeta {
    readonly firstName: string;
    readonly lastName: string;
}
interface DrawerUser {
    readonly id: string;
    readonly email: string;
    readonly meta: DrawerUserMeta;
}
interface UserRole {
    readonly id: string;
    readonly name: string;
    readonly permissions: ReadonlyArray<string>;
}
interface UserStore {
    readonly id: string;
    readonly name: string;
}
interface User {
    readonly id: string;
    readonly email: string;
    readonly meta: DrawerUserMeta;
    readonly phoneNumber: string | null;
    readonly stores: ReadonlyArray<UserStore>;
    readonly role: UserRole | null;
}
interface Denominations {
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
interface CountRecord {
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
interface CashEvent {
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
interface DrawerCounts {
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
interface Drawer {
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
type DrawerActivityAction = "create" | "update" | "open" | "close" | "drop" | "pop" | "payin" | "payout" | (string & {});
interface DrawerActivityUsersChange {
    readonly to: ReadonlyArray<DrawerUser>;
    readonly from: ReadonlyArray<DrawerUser>;
}
interface DrawerActivityChanges {
    readonly name?: {
        readonly to: string;
        readonly from: string;
    } | null;
    readonly type?: {
        readonly to: string;
        readonly from: string;
    } | null;
    readonly dropTriggerBalance?: {
        readonly to: number;
        readonly from: number;
    } | null;
    readonly rooms?: {
        readonly to: ReadonlyArray<DrawerRoom>;
        readonly from: ReadonlyArray<DrawerRoom>;
    } | null;
    readonly users?: DrawerActivityUsersChange | null;
    readonly counts?: unknown | null;
}
interface DrawerActivity {
    readonly actionTimestamp: string;
    readonly action: DrawerActivityAction;
    readonly subaction: string | null;
    readonly employeeName: string;
    readonly snapshot: Drawer;
    readonly changedValues: DrawerActivityChanges | null;
}
interface DrawerTip {
    readonly name: string;
    /** cents */
    readonly amount: number;
}
interface ListDrawersParams {
    readonly hidden?: boolean;
    readonly orderBy?: string;
    readonly orderDirection?: "asc" | "desc";
}
interface ListActivityParams {
    /** YYYY-MM-DD */
    readonly startDate: string;
    /** YYYY-MM-DD */
    readonly endDate: string;
}
interface ListUsersParams {
    readonly storeUsers?: boolean;
    readonly storeId?: string;
    readonly storeIds?: ReadonlyArray<string>;
    readonly status?: string;
    readonly orderBy?: string;
    readonly isInternal?: boolean;
}
interface CreateDrawerInput {
    readonly name: string;
    readonly type: DrawerType | string;
    /** Room UUIDs the drawer is scoped to. At least one. */
    readonly rooms: ReadonlyArray<string>;
    /** cents */
    readonly dropTriggerBalance: number;
}
interface UpdateDrawerInput {
    readonly name: string;
    readonly type: DrawerType | string;
    readonly rooms: ReadonlyArray<string>;
    /** cents */
    readonly dropTriggerBalance: number;
}

interface DashboardHttpOptions {
    readonly baseUrl: string;
    readonly timeout: number;
    readonly fetchFn?: typeof fetch | undefined;
}
interface GraphQLRequest {
    readonly operationName: string;
    readonly variables: Record<string, unknown>;
    readonly query: string;
}
/**
 * Tiny HTTP helper for the dashboard module.
 *
 * Differs from the public-API HttpClient:
 * - Auth token is supplied per-request (not baked into the client) so the
 *   SessionAuth can rotate it independently.
 * - Supports binary downloads (returns Buffer) for CSV reports.
 * - GraphQL helper for login/refresh.
 *
 * No automatic retry: dashboard endpoints are reverse-engineered and we don't
 * want to hammer them.
 */
declare class DashboardHttp {
    private readonly baseUrl;
    private readonly timeout;
    private readonly fetchFn;
    constructor(options: DashboardHttpOptions);
    graphql<T>(request: GraphQLRequest, token?: string, path?: string): Promise<T>;
    downloadBinary(path: string, query: Record<string, string | number | boolean | undefined>, token: string): Promise<{
        data: Buffer;
        filename: string | undefined;
        contentType: string;
    }>;
    private fetchWithTimeout;
    private buildUrl;
    private parseContentDisposition;
    private mapError;
}

interface FlowhubDashboardCredentials {
    readonly email: string;
    readonly password: string;
}
interface ReportDownload {
    readonly data: Buffer;
    readonly filename: string;
    readonly contentType: string;
}
type ReportParams = Record<string, string | number | boolean | undefined>;
type DateRangeParams = ReportParams & {
    readonly start_date: string;
    readonly end_date: string;
};
type CommonReportParams = DateRangeParams & {
    readonly store_id?: string;
};
interface ReportParameterOption {
    readonly option: string;
    readonly value: string;
}
interface ReportParameterMetadata {
    readonly key: string;
    readonly type: string;
    readonly name: string | null;
    readonly description: string | null;
    readonly isRequired: boolean;
    readonly isHidden: boolean;
    readonly defaultValue: string | null;
    readonly options: ReadonlyArray<ReportParameterOption> | null;
}
interface ReportMetadata {
    readonly reportId: string;
    readonly name: string;
    readonly description: string | null;
    readonly type: string;
    readonly isCustom: boolean;
    readonly isFavorite: boolean;
    readonly parameters: ReadonlyArray<ReportParameterMetadata>;
}

/**
 * Manages the dashboard session token lifecycle.
 *
 * - Lazy login on first getToken() call
 * - Caches the token; reuses it until within 5 minutes of expiry
 * - Concurrency-safe: parallel getToken() calls share a single login request
 * - invalidate() clears the cache so the next getToken() re-logs in
 *
 * The cache lives in memory for the SessionAuth instance lifetime only.
 * Credentials and tokens are never persisted, logged, or included in errors.
 */
declare class SessionAuth {
    private readonly credentials;
    private readonly http;
    private cached;
    private pendingLogin;
    constructor(credentials: FlowhubDashboardCredentials, http: DashboardHttp);
    getToken(): Promise<string>;
    invalidate(): void;
    private login;
    private isExpiringSoon;
}

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
declare class DrawersResource {
    private readonly http;
    private readonly auth;
    constructor(http: DashboardHttp, auth: SessionAuth);
    /**
     * List drawers. With no params, returns all drawers. Pass `hidden: false`
     * to exclude soft-deleted drawers (matches what the dashboard's drawers
     * page polls every ~5 seconds).
     */
    list(params?: ListDrawersParams): Promise<Drawer[]>;
    /**
     * Fetch a single drawer by ID. Returns `null` if the server returns an
     * empty list (the drawer doesn't exist or is hidden).
     */
    get(id: string): Promise<Drawer | null>;
    /**
     * Audit feed for a single drawer over a date range. Includes create /
     * update / open / close / drop / pop / payin / payout events with the
     * full drawer snapshot at each point.
     */
    listActivity(drawerId: string, params: ListActivityParams): Promise<DrawerActivity[]>;
    /**
     * Tip totals associated with a particular drawer count (between an open
     * and a close). Keyed by `drawerCountId`, NOT the drawer's own ID.
     */
    listTips(drawerCountId: string): Promise<DrawerTip[]>;
    /**
     * Create a new drawer. `rooms` is a list of room UUIDs the drawer is
     * scoped to; `dropTriggerBalance` is in integer cents. Returned drawer
     * has `openedAt: null` and `counts: null` until `open()` is called.
     */
    create(input: CreateDrawerInput): Promise<Drawer>;
    /**
     * Update an existing drawer. Fires even on no-op edits — the server
     * tolerates that. Note: this does NOT manage user assignment; use
     * `assignUser` / `unassignUser` for that.
     */
    update(id: string, input: UpdateDrawerInput): Promise<Drawer>;
    /**
     * Delete a drawer. The server returns an empty array on success; this
     * method normalises that to `void`. The drawer is soft-deleted (hidden)
     * rather than physically removed.
     */
    delete(id: string): Promise<void>;
    /**
     * Assign a user to a drawer. Drawer↔user is many-to-many; calling this
     * with an already-assigned user is a no-op on the server side.
     */
    assignUser(drawerId: string, userId: string): Promise<Drawer>;
    /** Remove a user from a drawer. */
    unassignUser(drawerId: string, userId: string): Promise<Drawer>;
    private withAuthRetry;
}

/**
 * Downloads CSV reports from the Flowhub dashboard's internal analytics endpoints.
 *
 * All reports are GET requests at /analytics/<reportId> with query params.
 * Responses are CSV bytes (mislabeled as text/plain by the server).
 *
 * Methods retry exactly once on 401 by invalidating the cached token and
 * re-logging in; if the retry also 401s, FlowhubAuthError propagates.
 */
declare class ReportsResource {
    private readonly http;
    private readonly auth;
    private readonly defaultStoreId;
    constructor(http: DashboardHttp, auth: SessionAuth, defaultStoreId: string | undefined);
    /**
     * List all reports available to the authenticated user, including custom
     * and shared reports specific to their account. The returned `reportId`
     * values can be passed to `downloadReport()`.
     */
    listReports(): Promise<ReportMetadata[]>;
    /**
     * Download an arbitrary report by its ID.
     *
     * Use this for any of the ~60 report IDs Flowhub exposes (e.g. "accounting",
     * "category-sales", "inventory-snapshot"). Custom report UUIDs work too.
     */
    downloadReport(reportId: string, params?: ReportParams): Promise<ReportDownload>;
    /** Convenience: Accounting report (taxes, discounts, refunds, totals). */
    downloadAccounting(params: CommonReportParams): Promise<ReportDownload>;
    /** Convenience: Sales by day by store. */
    downloadSalesByDayStore(params: CommonReportParams): Promise<ReportDownload>;
    /** Convenience: Category sales summary. */
    downloadCategorySales(params: CommonReportParams): Promise<ReportDownload>;
    /** Convenience: End-of-day report. */
    downloadEndOfDay(params: CommonReportParams): Promise<ReportDownload>;
    /** Convenience: Transactions report. */
    downloadTransactions(params: CommonReportParams): Promise<ReportDownload>;
    /** Convenience: Inventory snapshot (no date range required). */
    downloadInventorySnapshot(params?: {
        store_id?: string;
    } & ReportParams): Promise<ReportDownload>;
    /** Convenience: Inventory levels. */
    downloadInventoryLevels(params?: {
        store_id?: string;
    } & ReportParams): Promise<ReportDownload>;
    private fallbackFilename;
}

/**
 * Read-only access to Flowhub rooms — primarily for resolving room IDs
 * when creating or updating a drawer (drawers are scoped to one or more
 * rooms within a store).
 *
 * Retries once on 401 by invalidating the cached token.
 */
declare class RoomsResource {
    private readonly http;
    private readonly auth;
    constructor(http: DashboardHttp, auth: SessionAuth);
    list(): Promise<Room[]>;
    private withAuthRetry;
}

/**
 * Read-only access to Flowhub users — primarily for resolving user IDs
 * when assigning users to drawers or attributing cash events.
 *
 * Retries once on 401 by invalidating the cached token.
 */
declare class UsersResource {
    private readonly http;
    private readonly auth;
    constructor(http: DashboardHttp, auth: SessionAuth);
    /**
     * List users. Pass `storeUsers: true` to scope to users assigned to a
     * store (the most common case when populating a "who performed this
     * action" dropdown).
     */
    list(params?: ListUsersParams): Promise<User[]>;
    private withAuthRetry;
}

declare const DEFAULT_DASHBOARD_BASE_URL: "https://api.flowhub.com";
interface FlowhubDashboardClientConfig {
    readonly email: string;
    readonly password: string;
    readonly storeId?: string | undefined;
    readonly baseUrl?: string | undefined;
    readonly timeout?: number | undefined;
}
declare class FlowhubDashboardClient {
    readonly reports: ReportsResource;
    readonly drawers: DrawersResource;
    readonly users: UsersResource;
    readonly rooms: RoomsResource;
    readonly storeId: string | undefined;
    private readonly config;
    constructor(config: FlowhubDashboardClientConfig);
    /** Returns a new client scoped to the given storeId for default report params. */
    forStore(storeId: string): FlowhubDashboardClient;
}

export { type CashEvent, type CommonReportParams, type CountRecord, type CreateDrawerInput, DEFAULT_DASHBOARD_BASE_URL, type DateRangeParams, type Denominations, type Drawer, type DrawerActivity, type DrawerActivityAction, type DrawerActivityChanges, type DrawerActivityUsersChange, type DrawerCounts, type DrawerRoom, type DrawerTip, type DrawerType, type DrawerUser, type DrawerUserMeta, DrawersResource, FlowhubDashboardClient, type FlowhubDashboardClientConfig, type ListActivityParams, type ListDrawersParams, type ListUsersParams, type ReportDownload, type ReportMetadata, type ReportParameterMetadata, type ReportParameterOption, type ReportParams, type Room, RoomsResource, type UpdateDrawerInput, type User, type UserRole, type UserStore, UsersResource };
