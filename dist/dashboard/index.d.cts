export { F as FlowhubAuthError, a as FlowhubError, b as FlowhubNotFoundError, c as FlowhubRateLimitError, d as FlowhubValidationError } from '../errors-CktRSCIZ.cjs';

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
    readonly storeId: string | undefined;
    private readonly config;
    constructor(config: FlowhubDashboardClientConfig);
    /** Returns a new client scoped to the given storeId for default report params. */
    forStore(storeId: string): FlowhubDashboardClient;
}

export { type CommonReportParams, DEFAULT_DASHBOARD_BASE_URL, type DateRangeParams, FlowhubDashboardClient, type FlowhubDashboardClientConfig, type ReportDownload, type ReportMetadata, type ReportParameterMetadata, type ReportParameterOption, type ReportParams };
