import type { HttpClient } from "../http.js";
import type { FlowhubResponse } from "../pagination.js";
import { buildPaginationQuery, paginate } from "../pagination.js";
import type { InventoryItem, ListInventoryParams } from "../types/inventory.js";

export class InventoryResource {
	constructor(private readonly http: HttpClient) {}

	async list(params?: ListInventoryParams): Promise<FlowhubResponse<InventoryItem>> {
		const query = {
			...buildPaginationQuery(params),
			...(params?.locationId !== undefined ? { locationId: params.locationId } : {}),
		};
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: "/v0/inventory",
			query,
		});
	}

	async *iterate(params?: ListInventoryParams): AsyncGenerator<InventoryItem, void, undefined> {
		yield* paginate<InventoryItem, ListInventoryParams>(
			(p) => this.list(p),
			params ?? {},
			params?.limit,
		);
	}
}
