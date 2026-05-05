import type { FlowhubCredentials } from "./auth.js";
import { HttpClient } from "./http.js";
import { AuthTokenResource } from "./resources/auth-token.js";
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
	readonly authToken: AuthTokenResource;

	/** The locationId this client is scoped to, if any. */
	readonly locationId: string | undefined;

	private readonly http: HttpClient;
	private readonly options: FlowhubClientOptions;

	constructor(options: FlowhubClientOptions, locationId?: string | undefined) {
		this.options = options;
		this.locationId = locationId;
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
		this.inventory = new InventoryResource(this.http, locationId);
		this.orderAhead = new OrderAheadResource(this.http);
		this.authToken = new AuthTokenResource();
	}

	/**
	 * Returns a new client scoped to a specific location.
	 * The scoped client's inventory methods use /v0/locations/{locationId}/... endpoints.
	 */
	forLocation(locationId: string): FlowhubClient {
		return new FlowhubClient(this.options, locationId);
	}
}
