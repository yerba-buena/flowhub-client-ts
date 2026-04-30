import type { FlowhubCredentials } from "./auth.js";
import { HttpClient } from "./http.js";
import { LocationsResource } from "./resources/locations.js";

export interface FlowhubClientOptions {
	readonly clientId: string;
	readonly apiKey: string;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
	readonly retries?: number | undefined;
}

export class FlowhubClient {
	readonly locations: LocationsResource;

	private readonly http: HttpClient;
	private readonly options: FlowhubClientOptions;

	constructor(options: FlowhubClientOptions) {
		this.options = options;
		const credentials: FlowhubCredentials = {
			clientId: options.clientId,
			apiKey: options.apiKey,
		};
		this.http = new HttpClient({
			credentials,
			baseUrl: options.baseUrl,
			timeout: options.timeout,
			retries: options.retries,
		});
		this.locations = new LocationsResource(this.http);
	}

	forLocation(_locationId: string): FlowhubClient {
		return new FlowhubClient({ ...this.options });
	}
}
