import type { HttpClient } from "../http.js";
import type {
	OrderAheadActionParams,
	OrderAheadStatusParams,
	OrderAheadSubmitParams,
} from "../types/orders.js";

export class OrderAheadResource {
	constructor(private readonly http: HttpClient) {}

	async submit(params: OrderAheadSubmitParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: "/orders/submit",
			body: params,
		});
	}

	async cancel(params: OrderAheadActionParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: "/orders/cancel",
			body: params,
		});
	}

	async confirm(params: OrderAheadActionParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: "/orders/confirm",
			body: params,
		});
	}

	async complete(params: OrderAheadActionParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: "/orders/complete",
			body: params,
		});
	}

	async updateStatus(params: OrderAheadStatusParams): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: "/orders/status",
			body: params,
		});
	}

	async update(params: Record<string, unknown>): Promise<Record<string, unknown>> {
		return this.http.request<Record<string, unknown>>({
			method: "PATCH",
			path: "/orders/update",
			body: params,
		});
	}
}
