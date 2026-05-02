import type { FlowhubCredentials } from "./auth.js";
import { HttpClient } from "./http.js";
import { InventoryResource } from "./resources/inventory.js";
import { LocationsResource } from "./resources/locations.js";
import { OrderAheadResource } from "./resources/order-ahead.js";

export interface FlowhubClientOptions {
	readonly clientId: string;
	readonly apiKey: string;
	readonly accessToken?: string | undefined;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
	readonly retries?: number | undefined;
}

export class FlowhubClient {
	readonly locations: LocationsResource;
	readonly inventory: InventoryResource;
	readonly orderAhead: OrderAheadResource;

	private readonly http: HttpClient;
	private readonly options: FlowhubClientOptions;

	constructor(options: FlowhubClientOptions) {
		this.options = options;
		const credentials: FlowhubCredentials = {
			clientId: options.clientId,
			apiKey: options.apiKey,
			accessToken: options.accessToken,
		};
		this.http = new HttpClient({
			credentials,
			baseUrl: options.baseUrl,
			timeout: options.timeout,
			retries: options.retries,
		});
		this.locations = new LocationsResource(this.http);
		this.inventory = new InventoryResource(this.http);
		this.orderAhead = new OrderAheadResource(this.http);
	}

	forLocation(_locationId: string): FlowhubClient {
		return new FlowhubClient({ ...this.options });
	}
}
