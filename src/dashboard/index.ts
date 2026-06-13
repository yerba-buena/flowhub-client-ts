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

// Re-export the entire new surface unchanged (types, resources, errors, watcher).
export * from "../internal/index.js";

import {
	DEFAULT_INTERNAL_BASE_URL,
	FlowhubInternalClient,
	type FlowhubInternalClientConfig,
} from "../internal/index.js";

/**
 * @deprecated Renamed to `FlowhubInternalClient`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
export const FlowhubDashboardClient = FlowhubInternalClient;
/**
 * @deprecated Renamed to `FlowhubInternalClient`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
export type FlowhubDashboardClient = FlowhubInternalClient;

/**
 * @deprecated Renamed to `FlowhubInternalClientConfig`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
export type FlowhubDashboardClientConfig = FlowhubInternalClientConfig;

/**
 * @deprecated Renamed to `DEFAULT_INTERNAL_BASE_URL`. Import from
 * `@yerba-buena/flowhub-client/internal`.
 */
export const DEFAULT_DASHBOARD_BASE_URL = DEFAULT_INTERNAL_BASE_URL;
