/**
 * Types for the employees (staff roster) resource.
 *
 * Backed by the Flowhub dashboard's `filteredUsers` GraphQL field (operations
 * `GetAllUsers` for the paginated roster and `GetOneUser` for a single record).
 * Reverse-engineered from the dashboard's Employees screen — see
 * `docs/employees-discovery.md`.
 *
 * Purpose: provide a deterministic `email → id` mapping. The employee `id` is a
 * UUID that is expected to equal the `budtenderId` carried on `Sale` records
 * (see the note on {@link Employee.id}). Only roster-relevant fields are
 * exposed; the dashboard's full user payload also includes an `apiKeys` block
 * (containing secrets) which is deliberately **not** selected or surfaced here.
 */

/** Observed value is `active`; `inactive` is the expected complement. Permissive. */
export type EmployeeStatus = "active" | "inactive" | (string & {});

export type EmployeeOrderBy = "firstName" | "lastName" | "email" | "createdAt" | (string & {});

export type OrderDirection = "asc" | "desc";

export interface EmployeeRole {
	readonly id: string;
	readonly name: string;
}

export interface EmployeeStore {
	readonly id: string;
	readonly name: string;
}

export interface Employee {
	/**
	 * User UUID. Expected to equal `Sale.budtenderId` — this is the whole point
	 * of the resource (bridging YBAM email identity to the seller on a sale).
	 * The equality is asserted by the Flowhub data model but should be spot-checked
	 * against a real `Sale` once, per issue #10's acceptance criteria.
	 */
	readonly id: string;
	/** `"First Last"` (trimmed). Matches the `Sale.budtender` display name. */
	readonly name: string;
	readonly firstName: string | null;
	readonly lastName: string | null;
	/** The bridge to YBAM identity. */
	readonly email: string;
	readonly phoneNumber: string | null;
	readonly status: EmployeeStatus;
	/** Convenience: `status === "active"`. */
	readonly active: boolean;
	readonly isInternal: boolean;
	readonly activeStoreId: string | null;
	readonly role: EmployeeRole | null;
	/** Store UUIDs this employee belongs to (from `stores[].id`). */
	readonly storeIds: ReadonlyArray<string>;
	readonly stores: ReadonlyArray<EmployeeStore>;
}

export interface ListEmployeesParams {
	/** Scope to a single store/location UUID. Defaults to the client's storeId. */
	readonly storeId?: string;
	/** Free-text search (matches name/email as in the dashboard search box). */
	readonly search?: string;
	/** Defaults to `"active"`. Pass `"all"` to include inactive employees. */
	readonly status?: EmployeeStatus | "all";
	readonly roleId?: string;
	readonly limit?: number;
	readonly offset?: number;
	readonly orderBy?: EmployeeOrderBy;
	readonly orderDirection?: OrderDirection;
}
