import { FlowhubAuthError } from "../errors.js";
import type { InternalHttp } from "./http.js";
import type { FlowhubInternalCredentials, InternalLoginResponse } from "./types.js";

const REFRESH_MARGIN_SECONDS = 5 * 60;

const LOGIN_QUERY = `
query Login($email: String!, $password: String!) {
  login(login: { email: $email, password: $password }) {
    id
    refreshId
    expireTime
  }
}
`;

interface CachedToken {
	readonly id: string;
	readonly refreshId: string;
	readonly expireTime: number;
}

/**
 * Manages the dashboard session token lifecycle.
 *
 * - Lazy login on first getToken() call
 * - Caches the token; reuses it until within 5 minutes of expiry
 * - Concurrency-safe: parallel getToken() calls share a single login request
 * - invalidate() clears the cache so the next getToken() re-logs in
 *
 * The cache lives in memory for the SessionAuth instance lifetime only.
 * Credentials and tokens are never persisted, logged, or included in errors.
 */
export class SessionAuth {
	private readonly credentials: FlowhubInternalCredentials;
	private readonly http: InternalHttp;
	private cached: CachedToken | undefined;
	private pendingLogin: Promise<CachedToken> | undefined;

	constructor(credentials: FlowhubInternalCredentials, http: InternalHttp) {
		this.credentials = credentials;
		this.http = http;
	}

	async getToken(): Promise<string> {
		if (this.cached && !this.isExpiringSoon(this.cached)) {
			return this.cached.id;
		}

		if (this.pendingLogin) {
			const result = await this.pendingLogin;
			return result.id;
		}

		this.pendingLogin = this.login();
		try {
			const result = await this.pendingLogin;
			this.cached = result;
			return result.id;
		} finally {
			this.pendingLogin = undefined;
		}
	}

	invalidate(): void {
		this.cached = undefined;
	}

	private async login(): Promise<CachedToken> {
		try {
			const data = await this.http.graphql<{ login: InternalLoginResponse }>({
				operationName: "Login",
				variables: {
					email: this.credentials.email,
					password: this.credentials.password,
				},
				query: LOGIN_QUERY,
			});
			if (!data.login || !data.login.id) {
				throw new FlowhubAuthError("Login response missing token");
			}
			return {
				id: data.login.id,
				refreshId: data.login.refreshId,
				expireTime: data.login.expireTime,
			};
		} catch (err) {
			if (err instanceof FlowhubAuthError) throw err;
			throw new FlowhubAuthError("Dashboard login failed", { cause: err });
		}
	}

	private isExpiringSoon(token: CachedToken): boolean {
		const nowSeconds = Math.floor(Date.now() / 1000);
		return token.expireTime - nowSeconds <= REFRESH_MARGIN_SECONDS;
	}
}
