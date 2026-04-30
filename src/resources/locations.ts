import type { HttpClient } from "../http.js";
import type { FlowhubResponse } from "../pagination.js";
import { buildPaginationQuery, paginate } from "../pagination.js";
import type { ListLocationsParams, Location } from "../types/locations.js";

export class LocationsResource {
	constructor(private readonly http: HttpClient) {}

	async list(params?: ListLocationsParams): Promise<FlowhubResponse<Location>> {
		return this.http.request<FlowhubResponse<Location>>({
			path: "/v0/clientsLocations",
			query: buildPaginationQuery(params),
		});
	}

	async *iterate(params?: ListLocationsParams): AsyncGenerator<Location, void, undefined> {
		yield* paginate<Location, ListLocationsParams>(
			(p) => this.list(p),
			params ?? {},
			params?.limit,
		);
	}
}
