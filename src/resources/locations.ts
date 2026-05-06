import type { HttpClient } from "../http.js";
import type { FlowhubResponse } from "../pagination.js";
import type { Location } from "../types/locations.js";

export class LocationsResource {
	constructor(private readonly http: HttpClient) {}

	async list(): Promise<FlowhubResponse<Location>> {
		return this.http.request<FlowhubResponse<Location>>({
			path: "/v0/clientsLocations",
		});
	}
}
