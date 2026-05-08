import type { HttpClient } from "../http.js";
import type {
	Customer,
	CustomerWriteParams,
	CustomersListParams,
	OrdersListResponse,
	PaginationParams,
} from "../types/orders-api.js";

type QueryRecord = Record<string, string | number | boolean | undefined>;

function paginationQuery(params?: PaginationParams): QueryRecord {
	if (!params) return {};
	return {
		created_after: params.created_after,
		created_before: params.created_before,
		page: params.page,
		page_size: params.page_size,
		order_by: params.order_by,
	};
}

export class OrdersResource {
	constructor(private readonly http: HttpClient) {}

	// ── Customers ─────────────────────────────────────────────────

	/**
	 * GET /v1/customers/ — Query customers.
	 *
	 * The spec declares a single customer-model response for this endpoint.
	 * The actual API may return an array or paginated envelope — adjust the
	 * return type once validated against a live response.
	 */
	async getCustomers(params?: CustomersListParams): Promise<Customer> {
		return this.http.request<Customer>({
			path: "/v1/customers/",
			query: {
				...paginationQuery(params),
				updated_after: params?.updated_after,
				updated_before: params?.updated_before,
			},
		});
	}

	/** GET /v1/customers/{customerId} — Get a customer by ID */
	async getCustomerById(
		customerId: string,
		opts?: { store_id?: string | undefined },
	): Promise<Customer> {
		return this.http.request<Customer>({
			path: `/v1/customers/${customerId}`,
			query: { store_id: opts?.store_id },
		});
	}

	/** GET /v1/customers/findByPhoneNumber — Get a customer by phone number */
	async getCustomerByPhone(phoneNumber: string): Promise<Customer> {
		return this.http.request<Customer>({
			path: "/v1/customers/findByPhoneNumber",
			query: { phone_number: phoneNumber },
		});
	}

	/** POST /v1/customer?store_id={store_id} — Create a customer */
	async createCustomer(storeId: string, params: CustomerWriteParams): Promise<Customer> {
		return this.http.request<Customer>({
			method: "POST",
			path: "/v1/customer",
			query: { store_id: storeId },
			body: params,
		});
	}

	/** PUT /v1/customer/{customerId}?store_id={store_id} — Update a customer */
	async updateCustomer(
		customerId: string,
		storeId: string,
		params: CustomerWriteParams,
	): Promise<Customer> {
		return this.http.request<Customer>({
			method: "PUT",
			path: `/v1/customer/${customerId}`,
			query: { store_id: storeId },
			body: params,
		});
	}

	// ── Orders (Sales) ────────────────────────────────────────────

	/** GET /v1/orders/findByCustomerId/{customerId} — List orders for a customer */
	async listByCustomerId(
		customerId: string,
		params?: PaginationParams,
	): Promise<OrdersListResponse> {
		return this.http.request<OrdersListResponse>({
			path: `/v1/orders/findByCustomerId/${customerId}`,
			query: paginationQuery(params),
		});
	}

	/** GET /v1/orders/findByLocationId/{importId} — List orders for a location */
	async listByLocationId(importId: string, params?: PaginationParams): Promise<OrdersListResponse> {
		return this.http.request<OrdersListResponse>({
			path: `/v1/orders/findByLocationId/${importId}`,
			query: paginationQuery(params),
		});
	}
}
