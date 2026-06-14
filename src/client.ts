import type { FlowhubCredentials } from "./auth.js";
import { HttpClient } from "./http.js";
import { AuthTokenResource } from "./resources/auth-token.js";
import { InventoryResource } from "./resources/inventory.js";
import { LocationsResource } from "./resources/locations.js";
import { OrderAheadResource } from "./resources/order-ahead.js";
import { OrdersResource } from "./resources/orders.js";

export interface FlowhubClientOptions {
	readonly clientId: string;
	readonly apiKey: string;
	readonly accessToken?: string | undefined;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
	readonly retries?: number | undefined;
	/**
	 * Custom `fetch` implementation used for all outbound requests (main API and
	 * the Auth0 token endpoint). Defaults to `globalThis.fetch`.
	 *
	 * This is the extension point for SSRF-safe egress: pass a `fetch` wired to a
	 * connection layer you control (e.g. an `undici` `Agent` with a pinned
	 * `connect.lookup`) so you can resolve-validate-and-pin the destination IP and
	 * close the DNS-rebinding window. See the README's "Custom fetch / SSRF
	 * hardening" section for a recipe.
	 */
	readonly fetchFn?: typeof fetch | undefined;
}

export class FlowhubClient {
	readonly locations: LocationsResource;
	readonly inventory: InventoryResource;
	readonly orders: OrdersResource;
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
			fetchFn: options.fetchFn,
		});
		this.locations = new LocationsResource(this.http);
		this.inventory = new InventoryResource(this.http, locationId);
		this.orders = new OrdersResource(this.http);
		this.orderAhead = new OrderAheadResource(this.http);
		this.authToken = new AuthTokenResource(options.fetchFn);
	}

	/**
	 * Returns a new client scoped to a specific location.
	 * The scoped client's inventory methods use /v0/locations/{locationId}/... endpoints.
	 */
	forLocation(locationId: string): FlowhubClient {
		return new FlowhubClient(this.options, locationId);
	}
}
