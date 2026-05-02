export interface FlowhubCredentials {
	readonly clientId: string;
	readonly apiKey: string;
	readonly accessToken?: string | undefined;
}

export function createAuthHeaders(credentials: FlowhubCredentials): Record<string, string> {
	if (credentials.accessToken) {
		return { Authorization: `Bearer ${credentials.accessToken}` };
	}
	return {
		clientId: credentials.clientId,
		key: credentials.apiKey,
	};
}

export function redactCredentials(credentials: FlowhubCredentials): Record<string, string> {
	return {
		clientId: `${credentials.clientId.slice(0, 8)}...`,
		apiKey: "***REDACTED***",
		...(credentials.accessToken ? { accessToken: "***REDACTED***" } : {}),
	};
}
