import { FlowhubInternalClient, FlowhubInternalClientConfig } from '../internal/index.js';
export { CashEvent, CashEventParams, CommonReportParams, CountRecord, CreateDrawerInput, DEFAULT_INTERNAL_BASE_URL, DateRangeParams, Denominations, Drawer, DrawerActivity, DrawerActivityAction, DrawerActivityChanges, DrawerActivityUsersChange, DrawerCounts, DrawerEvent, DrawerRoom, DrawerSource, DrawerTip, DrawerType, DrawerUser, DrawerUserMeta, DrawerWatcher, DrawerWatcherOptions, DrawersResource, Employee, EmployeeOrderBy, EmployeeRole, EmployeeStatus, EmployeeStore, EmployeesResource, ListActivityParams, ListDrawersParams, ListEmployeesParams, ListSalesParams, ListUsersParams, OrderDirection, PurchaseType, ReceiptDownload, ReceiptKind, ReceiptOptions, ReportDownload, ReportMetadata, ReportParameterMetadata, ReportParameterOption, ReportParams, Room, RoomsResource, Sale, SaleDrawerRef, SaleItem, SaleLoyalty, SaleSeller, SalesCustomerType, SalesOrderBy, SalesReportingStatus, SalesResource, UpdateDrawerInput, User, UserRole, UserStore, UsersResource, computeEvents } from '../internal/index.js';
export { F as FlowhubAuthError, a as FlowhubError, b as FlowhubNotFoundError, c as FlowhubRateLimitError, d as FlowhubValidationError } from '../errors-CktRSCIZ.js';

/**
 * @deprecated The `@yerba-buena/flowhub-client/dashboard` entry point has been
 * renamed to `@yerba-buena/flowhub-client/internal`. The old name was too
 * narrow: this surface covers *all* reverse-engineered, non-public Flowhub
 * endpoints (reports, cash management, …), not just "the dashboard".
 *
 * This module re-exports the new API under both the old names and the old import
 * path for backward compatibility, and will be removed in a future release.
 *
 * Migrate by updating your imports:
 *
 * ```ts
 * // before
 * import { FlowhubDashboardClient } from "@yerba-buena/flowhub-client/dashboard";
 * // after
 * import { FlowhubInternalClient } from "@yerba-buena/flowhub-client/internal";
 * ```
 *
 * Renamed symbols:
 * - `FlowhubDashboardClient`       → `FlowhubInternalClient`
 * - `FlowhubDashboardClientConfig` → `FlowhubInternalClientConfig`
 * - `DEFAULT_DASHBOARD_BASE_URL`   → `DEFAULT_INTERNAL_BASE_URL`
 */

/**
 * @deprecated Renamed to `FlowhubInternalClient`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
declare const FlowhubDashboardClient: typeof FlowhubInternalClient;
/**
 * @deprecated Renamed to `FlowhubInternalClient`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
type FlowhubDashboardClient = FlowhubInternalClient;
/**
 * @deprecated Renamed to `FlowhubInternalClientConfig`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
type FlowhubDashboardClientConfig = FlowhubInternalClientConfig;
/**
 * @deprecated Renamed to `DEFAULT_INTERNAL_BASE_URL`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
declare const DEFAULT_DASHBOARD_BASE_URL: "https://api.flowhub.com";

export { DEFAULT_DASHBOARD_BASE_URL, FlowhubDashboardClient, type FlowhubDashboardClientConfig, FlowhubInternalClient, FlowhubInternalClientConfig };
