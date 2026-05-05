import type { OAuthTokenRequest, OAuthTokenResponse } from "../types/auth.js";

const AUTH0_BASE_URL = "https://flowhub.auth0.com";

export class AuthTokenResource {
	private readonly fetchFn: typeof fetch;

	constructor(fetchFn?: typeof fetch | undefined) {
		this.fetchFn = fetchFn ?? globalThis.fetch;
	}

	/**
	 * POST /oauth/token — Obtain an OAuth2 access token from Auth0.
	 *
	 * This endpoint is on the Auth0 domain (flowhub.auth0.com), not the main
	 * Flowhub API. The returned access_token can be passed as the `accessToken`
	 * option when constructing a FlowhubClient to use Order Ahead endpoints.
	 */
	async getToken(params: OAuthTokenRequest): Promise<OAuthTokenResponse> {
		const response = await this.fetchFn(`${AUTH0_BASE_URL}/oauth/token`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(params),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw new Error(`OAuth token request failed (${response.status}): ${body}`);
		}

		return (await response.json()) as OAuthTokenResponse;
	}
}
