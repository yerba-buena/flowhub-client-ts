import { DEFAULT_TIMEOUT_MS } from "../constants.js";
import { FlowhubError } from "../errors.js";
import { DrawersResource } from "./cash-management.js";
import { EmployeesResource } from "./employees.js";
import { InternalHttp } from "./http.js";
import { ReportsResource } from "./reports.js";
import { RoomsResource } from "./rooms.js";
import { SessionAuth } from "./session-auth.js";
import { UsersResource } from "./users.js";

export const DEFAULT_INTERNAL_BASE_URL = "https://api.flowhub.com" as const;

export interface FlowhubInternalClientConfig {
	readonly email: string;
	readonly password: string;
	readonly storeId?: string | undefined;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
	/**
	 * Custom `fetch` implementation used for all outbound requests. Defaults to
	 * `globalThis.fetch`.
	 *
	 * Extension point for SSRF-safe egress: pass a `fetch` wired to a connection
	 * layer you control (e.g. an `undici` `Agent` with a pinned `connect.lookup`)
	 * to resolve-validate-and-pin the destination IP and close the DNS-rebinding
	 * window. See the README for a recipe.
	 */
	readonly fetchFn?: typeof fetch | undefined;
}

export class FlowhubInternalClient {
	readonly reports: ReportsResource;
	readonly drawers: DrawersResource;
	readonly users: UsersResource;
	readonly employees: EmployeesResource;
	readonly rooms: RoomsResource;
	readonly storeId: string | undefined;

	private readonly config: FlowhubInternalClientConfig;

	constructor(config: FlowhubInternalClientConfig) {
		if (!config.email || config.email.trim() === "") {
			throw new FlowhubError("FlowhubInternalClient: email is required");
		}
		if (!config.password || config.password === "") {
			throw new FlowhubError("FlowhubInternalClient: password is required");
		}
		this.config = config;
		this.storeId = config.storeId;

		const http = new InternalHttp({
			baseUrl: config.baseUrl ?? DEFAULT_INTERNAL_BASE_URL,
			timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
			fetchFn: config.fetchFn,
		});
		const auth = new SessionAuth({ email: config.email, password: config.password }, http);
		this.reports = new ReportsResource(http, auth, config.storeId);
		this.drawers = new DrawersResource(http, auth);
		this.users = new UsersResource(http, auth);
		this.employees = new EmployeesResource(http, auth, config.storeId);
		this.rooms = new RoomsResource(http, auth);
	}

	/** Returns a new client scoped to the given storeId for default report params. */
	forStore(storeId: string): FlowhubInternalClient {
		return new FlowhubInternalClient({ ...this.config, storeId });
	}
}
