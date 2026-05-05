export interface OAuthTokenRequest {
	readonly client_id: string;
	readonly client_secret: string;
	readonly audience: string;
	readonly grant_type: "client_credentials";
}

export interface OAuthTokenResponse {
	readonly access_token: string;
	readonly scope: string;
	readonly expires_in: number;
	readonly token_type: string;
}
