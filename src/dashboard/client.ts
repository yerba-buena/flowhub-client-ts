import { DEFAULT_TIMEOUT_MS } from "../constants.js";
import { FlowhubError } from "../errors.js";
import { DashboardHttp } from "./http.js";
import { ReportsResource } from "./reports.js";
import { SessionAuth } from "./session-auth.js";

export const DEFAULT_DASHBOARD_BASE_URL = "https://api.flowhub.com" as const;

export interface FlowhubDashboardClientConfig {
	readonly email: string;
	readonly password: string;
	readonly storeId?: string | undefined;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
}

export class FlowhubDashboardClient {
	readonly reports: ReportsResource;
	readonly storeId: string | undefined;

	private readonly config: FlowhubDashboardClientConfig;

	constructor(config: FlowhubDashboardClientConfig) {
		if (!config.email || config.email.trim() === "") {
			throw new FlowhubError("FlowhubDashboardClient: email is required");
		}
		if (!config.password || config.password === "") {
			throw new FlowhubError("FlowhubDashboardClient: password is required");
		}
		this.config = config;
		this.storeId = config.storeId;

		const http = new DashboardHttp({
			baseUrl: config.baseUrl ?? DEFAULT_DASHBOARD_BASE_URL,
			timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
		});
		const auth = new SessionAuth({ email: config.email, password: config.password }, http);
		this.reports = new ReportsResource(http, auth, config.storeId);
	}

	/** Returns a new client scoped to the given storeId for default report params. */
	forStore(storeId: string): FlowhubDashboardClient {
		return new FlowhubDashboardClient({ ...this.config, storeId });
	}
}
