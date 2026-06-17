import type { OrderDirection } from "./employees-types.js";

/**
 * Types for the sales resource.
 *
 * Backed by the dashboard's `filteredSales` GraphQL field (operation `GetSales`,
 * used for both the paginated list and single-sale lookup). Reverse-engineered
 * from the Cashier → Sales screen — see `docs/sales-discovery.md`.
 *
 * **Money is integer cents throughout** (e.g. `1200` = $12.00), matching the
 * cash-management types. The seller (`soldBy.id`) is the same user UUID exposed
 * by the `employees` resource (and the public API's `Sale.budtenderId`), which
 * is what makes `employees.get(sale.soldBy.id)` resolve a seller's email.
 */

export type PurchaseType = "REC" | "MED" | (string & {});
export type SalesCustomerType = "REC" | "MED" | (string & {});
export type SalesOrderBy = "completedAt" | (string & {});
export type SalesReportingStatus = "all" | "reported" | "unreported" | (string & {});

export interface SaleSeller {
	/** User UUID — equals the `employees` resource `id` and `Sale.budtenderId`. */
	readonly id: string;
	readonly firstName: string | null;
	readonly lastName: string | null;
	/** `"First Last"` (trimmed). */
	readonly name: string;
}

export interface SaleDrawerRef {
	readonly id: string;
	readonly name: string;
}

export interface SaleLoyalty {
	readonly pointsEarned: number;
	readonly pointsSpent: number;
}

export interface SaleItem {
	readonly id: string;
	readonly inventoryId: string | null;
	readonly categoryId: string | null;
	readonly brand: string | null;
	readonly productName: string;
	readonly variantName: string | null;
	readonly sku: string | null;
	readonly regulatoryId: string | null;
	readonly isSoldByWeight: boolean;
	readonly quantity: number;
	/** cents */
	readonly preTaxPrice: number;
	/** cents */
	readonly postTaxPrice: number;
	/** cents */
	readonly totalItemCost: number;
	/** cents */
	readonly totalPrice: number;
	/** cents */
	readonly totalDiscounts: number;
	/** cents */
	readonly totalTaxes: number;
}

export interface Sale {
	readonly id: string;
	readonly source: string | null;
	readonly receiptId: string | null;
	readonly storeId: string;
	readonly storeName: string | null;
	readonly purchaseType: PurchaseType;
	/** ISO 8601 timestamp. */
	readonly completedAt: string;
	readonly editedCount: number | null;
	readonly soldBy: SaleSeller | null;
	readonly drawer: SaleDrawerRef | null;
	/** cents */
	readonly totalPreTaxPrice: number;
	/** cents */
	readonly totalPostTaxPrice: number;
	/** cents */
	readonly totalItemPrice: number;
	/** cents */
	readonly totalDiscounts: number;
	/** cents */
	readonly totalTaxes: number;
	/** cents */
	readonly totalFees: number;
	/** cents — the grand total. Useful for AOV. */
	readonly totalPrice: number;
	readonly loyalty: SaleLoyalty | null;
	readonly items: ReadonlyArray<SaleItem>;
	/** Derived: sum of `items[].quantity` (units per transaction / UPT). */
	readonly itemCount: number;
}

export interface ListSalesParams {
	/** Required. `YYYY-MM-DD`. */
	readonly startDate: string;
	/** Required. `YYYY-MM-DD`. */
	readonly endDate: string;
	/** Filter to specific seller user UUIDs (the `employees`/`soldBy` id). */
	readonly employeeIds?: ReadonlyArray<string>;
	readonly drawerIds?: ReadonlyArray<string>;
	readonly customerType?: SalesCustomerType;
	readonly paymentMethod?: string;
	readonly source?: string;
	/** Free-text search (customer name, receipt id, etc., as in the UI). */
	readonly search?: string;
	/** Defaults server-side; `"all"` in the dashboard. */
	readonly reportingStatus?: SalesReportingStatus;
	/** Include sales from every store the user can access (default false). */
	readonly shouldIncludeAllStores?: boolean;
	readonly orderBy?: SalesOrderBy;
	readonly orderDirection?: OrderDirection;
	readonly limit?: number;
	readonly offset?: number;
}
