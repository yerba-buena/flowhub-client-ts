import type { HttpClient } from "../http.js";
import type { FlowhubResponse } from "../pagination.js";
import { buildPaginationQuery, paginate } from "../pagination.js";
import type {
	InventoryAnalyticsByRoomItem,
	InventoryAnalyticsItem,
	InventoryByRoomItem,
	InventoryItem,
	ListInventoryAnalyticsParams,
	ListInventoryParams,
} from "../types/inventory.js";

function buildAnalyticsQuery(
	params?: ListInventoryAnalyticsParams,
): Record<string, string | number | boolean | undefined> {
	return {
		...buildPaginationQuery(params),
		...(params?.includesNotForSaleQuantity !== undefined
			? { includesNotForSaleQuantity: params.includesNotForSaleQuantity }
			: {}),
	};
}

export class InventoryResource {
	private readonly scopedLocationId: string | undefined;

	constructor(
		private readonly http: HttpClient,
		locationId?: string | undefined,
	) {
		this.scopedLocationId = locationId;
	}

	private inventoryPath(suffix: string, scopedSuffix?: string | undefined): string {
		if (this.scopedLocationId) {
			return `/v0/locations/${this.scopedLocationId}/${scopedSuffix ?? suffix}`;
		}
		return `/v0/${suffix}`;
	}

	// ── Global (all-locations) endpoints ──────────────────────────────
	// When this resource is scoped via forLocation(), these automatically
	// use the /v0/locations/{locationId}/... paths instead.

	async list(params?: ListInventoryParams): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: this.inventoryPath("inventory"),
			query: buildPaginationQuery(params),
		});
	}

	async listNonZero(params?: ListInventoryParams): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: this.inventoryPath("inventoryNonZero"),
			query: buildPaginationQuery(params),
		});
	}

	async listByRoomsNonZero(
		params?: ListInventoryParams,
	): Promise<FlowhubResponse<InventoryByRoomItem>> {
		return this.http.request<FlowhubResponse<InventoryByRoomItem>>({
			path: this.inventoryPath("inventoryByRoomsNonZero"),
			query: buildPaginationQuery(params),
		});
	}

	async listAnalytics(
		params?: ListInventoryAnalyticsParams,
	): Promise<FlowhubResponse<InventoryAnalyticsItem>> {
		return this.http.request<FlowhubResponse<InventoryAnalyticsItem>>({
			path: this.inventoryPath("inventoryAnalytics", "InventoryAnalytics"),
			query: buildAnalyticsQuery(params),
		});
	}

	async listAnalyticsByRooms(
		params?: ListInventoryAnalyticsParams,
	): Promise<FlowhubResponse<InventoryAnalyticsByRoomItem>> {
		return this.http.request<FlowhubResponse<InventoryAnalyticsByRoomItem>>({
			path: this.inventoryPath("inventoryAnalyticsByRooms", "InventoryAnalyticsByRooms"),
			query: buildAnalyticsQuery(params),
		});
	}

	// ── Per-location endpoints ────────────────────────────────────────

	async listByLocation(
		locationId: string,
		params?: ListInventoryParams,
	): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: `/v0/locations/${locationId}/inventory`,
			query: buildPaginationQuery(params),
		});
	}

	async listByLocationNonZero(
		locationId: string,
		params?: ListInventoryParams,
	): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: `/v0/locations/${locationId}/inventoryNonZero`,
			query: buildPaginationQuery(params),
		});
	}

	async listByLocationByRoomsNonZero(
		locationId: string,
		params?: ListInventoryParams,
	): Promise<FlowhubResponse<InventoryByRoomItem>> {
		return this.http.request<FlowhubResponse<InventoryByRoomItem>>({
			path: `/v0/locations/${locationId}/inventoryByRoomsNonZero`,
			query: buildPaginationQuery(params),
		});
	}

	async listAnalyticsByLocation(
		locationId: string,
		params?: ListInventoryAnalyticsParams,
	): Promise<FlowhubResponse<InventoryAnalyticsItem>> {
		return this.http.request<FlowhubResponse<InventoryAnalyticsItem>>({
			path: `/v0/locations/${locationId}/InventoryAnalytics`,
			query: buildAnalyticsQuery(params),
		});
	}

	async listAnalyticsByLocationByRooms(
		locationId: string,
		params?: ListInventoryAnalyticsParams,
	): Promise<FlowhubResponse<InventoryAnalyticsByRoomItem>> {
		return this.http.request<FlowhubResponse<InventoryAnalyticsByRoomItem>>({
			path: `/v0/locations/${locationId}/InventoryAnalyticsByRooms`,
			query: buildAnalyticsQuery(params),
		});
	}

	// ── Iterators ─────────────────────────────────────────────────────

	async *iterate(params?: ListInventoryParams): AsyncGenerator<InventoryItem, void, undefined> {
		yield* paginate<InventoryItem, ListInventoryParams>(
			(p) => this.list(p),
			params ?? {},
			params?.limit,
		);
	}

	async *iterateNonZero(
		params?: ListInventoryParams,
	): AsyncGenerator<InventoryItem, void, undefined> {
		yield* paginate<InventoryItem, ListInventoryParams>(
			(p) => this.listNonZero(p),
			params ?? {},
			params?.limit,
		);
	}

	async *iterateByRoomsNonZero(
		params?: ListInventoryParams,
	): AsyncGenerator<InventoryByRoomItem, void, undefined> {
		yield* paginate<InventoryByRoomItem, ListInventoryParams>(
			(p) => this.listByRoomsNonZero(p),
			params ?? {},
			params?.limit,
		);
	}

	async *iterateAnalytics(
		params?: ListInventoryAnalyticsParams,
	): AsyncGenerator<InventoryAnalyticsItem, void, undefined> {
		yield* paginate<InventoryAnalyticsItem, ListInventoryAnalyticsParams>(
			(p) => this.listAnalytics(p),
			params ?? {},
			params?.limit,
		);
	}

	async *iterateAnalyticsByRooms(
		params?: ListInventoryAnalyticsParams,
	): AsyncGenerator<InventoryAnalyticsByRoomItem, void, undefined> {
		yield* paginate<InventoryAnalyticsByRoomItem, ListInventoryAnalyticsParams>(
			(p) => this.listAnalyticsByRooms(p),
			params ?? {},
			params?.limit,
		);
	}
}
