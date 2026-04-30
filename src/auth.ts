export interface FlowhubCredentials {
	readonly clientId: string;
	readonly apiKey: string;
}

export function createAuthHeaders(credentials: FlowhubCredentials): Record<string, string> {
	return {
		clientId: credentials.clientId,
		key: credentials.apiKey,
	};
}

export function redactCredentials(credentials: FlowhubCredentials): Record<string, string> {
	return {
		clientId: `${credentials.clientId.slice(0, 8)}...`,
		apiKey: "***REDACTED***",
	};
}
