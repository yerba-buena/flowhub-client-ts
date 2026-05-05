import type { HttpClient } from "../http.js";
import type { CreateOrderParams, OrderResponse, UpdateOrderParams } from "../types/orders.js";

export class OrderAheadResource {
	constructor(private readonly http: HttpClient) {}

	/** POST /order-ahead/v0/create — Submit a new order ahead */
	async create(params: CreateOrderParams): Promise<OrderResponse> {
		return this.http.request<OrderResponse>({
			method: "POST",
			path: "/order-ahead/v0/create",
			body: params,
		});
	}

	/** PATCH /orders/{orderId} — Update an existing order */
	async update(orderId: string, params: UpdateOrderParams): Promise<OrderResponse> {
		return this.http.request<OrderResponse>({
			method: "PATCH",
			path: `/orders/${orderId}`,
			body: params,
		});
	}

	/** POST /orderPostback/{orderId} — Trigger order postback (returns 204) */
	async postback(orderId: string): Promise<void> {
		await this.http.request<void>({
			method: "POST",
			path: `/orderPostback/${orderId}`,
		});
	}

	/** GET /order-ahead/v0/orderStatus/{orderId} — Get order status */
	async getStatus(orderId: string): Promise<OrderResponse> {
		return this.http.request<OrderResponse>({
			path: `/order-ahead/v0/orderStatus/${orderId}`,
		});
	}

	/** GET /authTest — Test authentication (returns text) */
	async testAuth(): Promise<string> {
		return this.http.requestText({
			path: "/authTest",
		});
	}

	/** GET /health — Service health check (returns text) */
	async health(): Promise<string> {
		return this.http.requestText({
			path: "/health",
		});
	}
}
