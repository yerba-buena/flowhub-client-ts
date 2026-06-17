import { FlowhubAuthError } from "../errors.js";
import type { InternalHttp } from "./http.js";
import type { ListSalesParams, Sale, SaleDrawerRef, SaleItem, SaleLoyalty } from "./sales-types.js";
import type { SessionAuth } from "./session-auth.js";

/**
 * A focused, roster/performance-relevant subset of the dashboard's full
 * `SaleFields` fragment. `soldBy.meta` is a JSON scalar (`{ firstName, lastName }`),
 * so it is selected bare. The dashboard's much larger fragment (customer PII,
 * transactions, regulatory reports, …) is deliberately not selected.
 */
const SALE_FIELDS = `
    id
    source
    receiptId
    storeId
    storeName
    purchaseType
    completedAt
    editedCount
    soldBy { id meta }
    drawer { id name }
    totalPreTaxPrice
    totalPostTaxPrice
    totalItemPrice
    totalDiscounts
    totalTaxes
    totalFees
    totalPrice
    loyalty { pointsEarned pointsSpent }
    items {
      id
      inventoryId
      categoryId
      brand
      productName
      variantName
      sku
      regulatoryId
      isSoldByWeight
      quantity
      preTaxPrice
      postTaxPrice
      totalItemCost
      totalPrice
      totalDiscounts
      totalTaxes
    }
`;

const GET_SALES_QUERY = `
query GetSales(
  $startDate: Date
  $endDate: Date
  $limit: Int
  $offset: Int
  $id: Uuid
  $receiptId: ID
  $drawerIds: [ID]
  $employeeIds: [ID]
  $reportingStatus: SalesReportingStatus
  $customerType: SalesCustomerType
  $paymentMethod: PaymentMethod
  $source: String
  $orderBy: SalesOrderBy
  $orderDirection: OrderDirection
  $shouldIncludeAllStores: Boolean
  $search: String
) {
  sales: filteredSales(
    salesParams: {
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
      id: $id
      receiptId: $receiptId
      drawerIds: $drawerIds
      employeeIds: $employeeIds
      reportingStatus: $reportingStatus
      customerType: $customerType
      paymentMethod: $paymentMethod
      source: $source
      orderBy: $orderBy
      orderDirection: $orderDirection
      shouldIncludeAllStores: $shouldIncludeAllStores
      search: $search
    }
  ) {
${SALE_FIELDS}
  }
}
`;

/** Default page size when auto-paginating in `listAll()`. */
const LIST_ALL_PAGE_SIZE = 100;

interface RawSale {
	readonly id: string;
	readonly source: string | null;
	readonly receiptId: string | null;
	readonly storeId: string;
	readonly storeName: string | null;
	readonly purchaseType: string;
	readonly completedAt: string;
	readonly editedCount: number | null;
	readonly soldBy: {
		id: string;
		meta: { firstName?: string | null; lastName?: string | null } | null;
	} | null;
	readonly drawer: SaleDrawerRef | null;
	readonly totalPreTaxPrice: number;
	readonly totalPostTaxPrice: number;
	readonly totalItemPrice: number;
	readonly totalDiscounts: number;
	readonly totalTaxes: number;
	readonly totalFees: number;
	readonly totalPrice: number;
	readonly loyalty: SaleLoyalty | null;
	readonly items: ReadonlyArray<SaleItem> | null;
}

function toSale(s: RawSale): Sale {
	const firstName = s.soldBy?.meta?.firstName ?? null;
	const lastName = s.soldBy?.meta?.lastName ?? null;
	const soldBy = s.soldBy
		? {
				id: s.soldBy.id,
				firstName,
				lastName,
				name: [firstName, lastName].filter(Boolean).join(" ").trim(),
			}
		: null;
	const items = s.items ?? [];
	return {
		id: s.id,
		source: s.source ?? null,
		receiptId: s.receiptId ?? null,
		storeId: s.storeId,
		storeName: s.storeName ?? null,
		purchaseType: s.purchaseType,
		completedAt: s.completedAt,
		editedCount: s.editedCount ?? null,
		soldBy,
		drawer: s.drawer ?? null,
		totalPreTaxPrice: s.totalPreTaxPrice,
		totalPostTaxPrice: s.totalPostTaxPrice,
		totalItemPrice: s.totalItemPrice,
		totalDiscounts: s.totalDiscounts,
		totalTaxes: s.totalTaxes,
		totalFees: s.totalFees,
		totalPrice: s.totalPrice,
		loyalty: s.loyalty ?? null,
		items,
		itemCount: items.reduce((sum, it) => sum + (it.quantity ?? 0), 0),
	};
}

/**
 * Read-only access to completed sales via the dashboard's internal
 * `filteredSales` field. Distinct from the public orders/sales API: it carries
 * `soldBy { id }` (the seller's user UUID, equal to the `employees` id) and
 * accepts an `employeeIds` filter — purpose-built for per-budtender views.
 *
 * Requires dashboard credentials. Retries once on 401.
 */
export class SalesResource {
	constructor(
		private readonly http: InternalHttp,
		private readonly auth: SessionAuth,
	) {}

	/** List one page of sales within a date range. `startDate`/`endDate` required. */
	async list(params: ListSalesParams): Promise<Sale[]> {
		const variables: Record<string, unknown> = {
			startDate: params.startDate,
			endDate: params.endDate,
			limit: params.limit,
			offset: params.offset,
			employeeIds: params.employeeIds,
			drawerIds: params.drawerIds,
			reportingStatus: params.reportingStatus ?? "all",
			customerType: params.customerType,
			paymentMethod: params.paymentMethod,
			source: params.source,
			orderBy: params.orderBy ?? "completedAt",
			orderDirection: params.orderDirection ?? "desc",
			shouldIncludeAllStores: params.shouldIncludeAllStores ?? false,
			search: params.search ?? null,
		};

		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ sales: RawSale[] }>(
				{ operationName: "GetSales", variables, query: GET_SALES_QUERY },
				token,
			),
		);
		return data.sales.map(toSale);
	}

	/**
	 * Fetch every sale in the range by auto-paginating `list()`. `limit`/`offset`
	 * in `params` are ignored (managed internally).
	 */
	async listAll(params: Omit<ListSalesParams, "limit" | "offset">): Promise<Sale[]> {
		const all: Sale[] = [];
		let offset = 0;
		for (;;) {
			const page = await this.list({ ...params, limit: LIST_ALL_PAGE_SIZE, offset });
			all.push(...page);
			if (page.length < LIST_ALL_PAGE_SIZE) break;
			offset += LIST_ALL_PAGE_SIZE;
		}
		return all;
	}

	/** Fetch a single sale by its UUID, or `null` if not found. */
	async get(id: string): Promise<Sale | null> {
		const data = await this.withAuthRetry((token) =>
			this.http.graphql<{ sales: RawSale[] }>(
				{ operationName: "GetSales", variables: { id }, query: GET_SALES_QUERY },
				token,
			),
		);
		const sale = data.sales[0];
		return sale ? toSale(sale) : null;
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
