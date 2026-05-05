import type { HttpClient } from "../http.js";
import type { CreateOrderParams, UpdateOrderParams } from "../types/orders.js";

export class OrderAheadResource {
	constructor(private readonly http: HttpClient) {}

	/** POST /order-ahead/v0/create — Submit a new order ahead */
	async create(params: CreateOrderParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "POST",
			path: "/order-ahead/v0/create",
			body: params,
		});
	}

	/** PATCH /orders/{orderId} — Update an existing order */
	async update(orderId: string, params: UpdateOrderParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: `/orders/${orderId}`,
			body: params,
		});
	}

	/** POST /orderPostback/{orderId} — Trigger order postback */
	async postback(orderId: string): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "POST",
			path: `/orderPostback/${orderId}`,
		});
	}

	/** GET /order-ahead/v0/orderStatus/{orderId} — Get order status */
	async getStatus(orderId: string): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			path: `/order-ahead/v0/orderStatus/${orderId}`,
		});
	}

	/** GET /authTest — Test authentication */
	async testAuth(): Promise<string> {
		return this.http.request<string>({
			path: "/authTest",
		});
	}

	/** GET /health — Service health check */
	async health(): Promise<string> {
		return this.http.request<string>({
			path: "/health",
		});
	}
}
