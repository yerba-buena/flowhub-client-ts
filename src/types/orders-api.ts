// Types derived from orders-api.yaml (Swagger 2.0 spec)
// Covers: Customers CRUD, Orders queries
// Auth: clientId + key headers (apiKey), NOT Bearer token

// ── Customer (response model: customer-model) ───────────────────────

export interface CustomerGroup {
	readonly name: string;
}

export interface Customer {
	readonly id: string;
	readonly createdAt: string;
	readonly updatedAt: string;
	readonly type: "medCustomer" | "recCustomer";
	readonly name: string;
	readonly state: string;
	readonly birthDate: string;
	readonly isLoyal: boolean;
	readonly loyaltyPoints: number;
	/** Only present when store_id is included in request params and a loyalty program exists at that location. */
	readonly loyaltyPointsInPennies?: number | undefined;
	readonly phone: string;
	readonly email: string;
	readonly streetAddress1: string;
	readonly streetAddress2: string;
	readonly city: string;
	readonly zip: string;
	readonly country: string;
	readonly consentsToPromotionalEmail: boolean;
	readonly consentsToPromotionalSMS: boolean;
	readonly groups: readonly CustomerGroup[];
}

// ── Customer create/update body ─────────────────────────────────────

export interface CustomerWriteParams {
	/** yyyy-mm-dd format */
	readonly birthDate: string;
	/** Full name (first & last) */
	readonly name: string;
	/** 2-letter state abbreviation */
	readonly state: string;
	readonly type: string;
	readonly city?: string | undefined;
	readonly consentsToPromotionalEmail?: boolean | undefined;
	readonly consentsToPromotionalSMS?: boolean | undefined;
	readonly email?: string | undefined;
	readonly groups?: readonly { readonly groupId?: string | undefined }[] | undefined;
	readonly isLoyal?: boolean | undefined;
	readonly loyaltyPoints?: number | undefined;
	readonly medId?: string | undefined;
	/** yyyy-mm-dd format */
	readonly medIdExpiration?: string | undefined;
	readonly phone?: string | undefined;
	readonly stateId?: string | undefined;
	/** yyyy-mm-dd format */
	readonly stateIdExpiration?: string | undefined;
	readonly streetAddress1?: string | undefined;
	readonly streetAddress2?: string | undefined;
	readonly zip?: string | undefined;
}

// ── Query params ────────────────────────────────────────────────────

export interface PaginationParams {
	/**
	 * Lower date bound for list endpoints (e.g. `listByLocationId`). Fetching a
	 * bounded window (a single week) instead of paginating an entire location's
	 * order history is the single biggest lever for staying under the API rate
	 * limit — confirmed ~98% fewer rows for a week vs. full history.
	 *
	 * **Must be `YYYY-MM-DD`** — a full ISO timestamp is rejected by Flowhub with
	 * `404 …must be in format yyyy-mm-dd` (the client validates this and throws
	 * `FlowhubValidationError` first).
	 *
	 * **Timezone:** the bound is applied in the **store's local time**, not UTC,
	 * and keys on the order's **creation** date. When building a week window for
	 * a UTC-based system, expect edge orders near local midnight (e.g. a
	 * `2026-06-13T02:00Z` order falls in the `…-06-12` window for an ET store).
	 */
	readonly created_after?: string | undefined;
	/** Upper date bound for list endpoints. See {@link PaginationParams.created_after}. */
	readonly created_before?: string | undefined;
	readonly page?: number | undefined;
	readonly page_size?: number | undefined;
	readonly order_by?: "asc" | "desc" | undefined;
}

export interface CustomersListParams extends PaginationParams {
	readonly updated_after?: string | undefined;
	readonly updated_before?: string | undefined;
}

// ── Sale / Order (response model: order-model) ─────────────────────

export interface SaleTotals {
	/** Grand total charged (post-tax, post-fees). Integer cents. Use for **post-tax AOV**. */
	readonly FinalTotal: number;
	/** Pre-tax item subtotal. Integer cents. Use for **pre-tax AOV**. */
	readonly SubTotal: number;
	readonly TotalDiscounts: number;
	readonly TotalFees: number;
	readonly TotalTaxes: number;
}

export interface SaleTax {
	readonly _id: string;
	readonly name: string;
	readonly percentage: number;
	readonly calculateBeforeDiscounts: string;
	readonly supplierSpecificTax: boolean;
	readonly excludeCustomerGroups: readonly string[];
	readonly enableCostMarkup: boolean;
	readonly markupPercentage: number;
	readonly thisTaxInPennies: number;
	readonly appliesTo: string;
}

export interface SaleItemDiscount {
	readonly _id: string;
	readonly name: string;
	readonly type: string;
	readonly discountAmount: number;
	readonly discountType: string;
	readonly discountId: string;
	readonly dollarsOff: number;
	readonly penniesOff: number;
	readonly percentOff: number;
	readonly discounterName: string;
	readonly discounterId: string;
	readonly isCartDiscount: boolean;
	readonly couponCode: string;
	readonly quantity: number;
}

export interface SaleItem {
	readonly id: string;
	readonly category: string;
	readonly itemDiscounts: readonly SaleItemDiscount[];
	readonly parentProductId: string;
	readonly productId: string;
	readonly productName: string;
	readonly quantity: number;
	readonly strainName: string;
	readonly sku: string;
	readonly tax: readonly SaleTax[];
	readonly title1: string;
	readonly title2: string;
	readonly totalCost: number;
	readonly totalPrice: number;
	readonly unitOfWeight: string;
	readonly unitPrice: number;
	readonly unitCost: number;
	readonly variantId: string;
	readonly brand: string;
	readonly type: string;
}

export interface SalePayment {
	readonly _id: string;
	readonly paymentType: string;
	readonly amount: number;
	readonly cardId: string;
	readonly loyaltyPoints: number;
	readonly debitProvider: string;
	readonly balanceAfterPayment: number;
}

export interface Sale {
	readonly id: string;
	/**
	 * Display name of the selling budtender. **Optional** — the public API marks
	 * this not-required and it has been observed absent on live orders.
	 */
	readonly budtender?: string | undefined;
	/**
	 * ID of the selling budtender on the **public** order. **Optional / not
	 * guaranteed present** (the API marks it not-required; observed absent in
	 * production).
	 *
	 * ⚠️ **Cross-client join key — read this before joining on it.** Do *not*
	 * assume `budtenderId` equals the internal `Employee.id`. That equality is
	 * verified only for the **internal** `sales` resource (`soldBy.id ==
	 * employees.id`). The public `budtenderId` is unconfirmed, may be a
	 * different id namespace, and is sometimes empty — joining seller metrics on
	 * it has produced all-zero results with no error. For per-seller metrics,
	 * prefer the internal `sales` resource and join on `soldBy.id`. See
	 * `docs/METRICS.md` and issues #19 / #18.
	 */
	readonly budtenderId?: string | undefined;
	readonly clientId: string;
	/** ISO 8601. When the order was created. `created_after`/`created_before` filter on this (store-local date). */
	readonly createdAt: string;
	/** ISO 8601. When the order was completed/sold — use this for "sales in period", not `createdAt`. */
	readonly completedOn: string;
	readonly currentPoints: number;
	readonly customerId: string;
	readonly customerType: "recCustomer" | "medCustomer";
	readonly fulfilledBy: string;
	readonly fulfilledById: string;
	readonly fullName: string;
	readonly integratorId: string;
	readonly itemsInCart: readonly SaleItem[];
	readonly locationId: string;
	readonly name: string;
	readonly orderId: string;
	/**
	 * Order status. ⚠️ **Live data returns lowercase** (e.g. `"sold"`), while
	 * Flowhub's docs example shows TitleCase (`"Sold"`). The API types it only as
	 * `string`, so this union is permissive — **compare case-insensitively**
	 * (e.g. `status.toLowerCase() === "sold"`).
	 */
	readonly orderStatus:
		| "sold"
		| "pending"
		| "cancelled"
		| "Sold"
		| "Pending"
		| "Cancelled"
		| (string & {});
	readonly orderType: string;
	readonly originalSaleId: string;
	readonly payments: readonly SalePayment[];
	readonly sentToFulfillmentBy: string;
	readonly sentToFulfillmentById: string;
	readonly totals: SaleTotals;
	/** When `true`, the sale was voided — exclude from revenue/AOV/UPT metrics. */
	readonly voided: boolean;
}

// ── Response envelopes ──────────────────────────────────────────────

export interface OrdersListResponse {
	readonly total: number;
	readonly orders: readonly Sale[];
}
