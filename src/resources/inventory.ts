import type { HttpClient } from "../http.js";
import type { FlowhubResponse } from "../pagination.js";
import type {
	InventoryAnalyticsByRoomItem,
	InventoryAnalyticsItem,
	InventoryByRoomItem,
	InventoryItem,
	ListInventoryAnalyticsParams,
} from "../types/inventory.js";

function buildAnalyticsQuery(
	params?: ListInventoryAnalyticsParams,
): Record<string, string | number | boolean | undefined> {
	if (!params?.includesNotForSaleQuantity) return {};
	return { includesNotForSaleQuantity: params.includesNotForSaleQuantity };
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

	async list(): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: this.inventoryPath("inventory"),
		});
	}

	async listNonZero(): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: this.inventoryPath("inventoryNonZero"),
		});
	}

	async listByRoomsNonZero(): Promise<FlowhubResponse<InventoryByRoomItem>> {
		return this.http.request<FlowhubResponse<InventoryByRoomItem>>({
			path: this.inventoryPath("inventoryByRoomsNonZero"),
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

	async listByLocation(locationId: string): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: `/v0/locations/${locationId}/inventory`,
		});
	}

	async listByLocationNonZero(locationId: string): Promise<FlowhubResponse<InventoryItem>> {
		return this.http.request<FlowhubResponse<InventoryItem>>({
			path: `/v0/locations/${locationId}/inventoryNonZero`,
		});
	}

	async listByLocationByRoomsNonZero(
		locationId: string,
	): Promise<FlowhubResponse<InventoryByRoomItem>> {
		return this.http.request<FlowhubResponse<InventoryByRoomItem>>({
			path: `/v0/locations/${locationId}/inventoryByRoomsNonZero`,
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
}
