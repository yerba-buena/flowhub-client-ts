import {
	FlowhubAuthError,
	FlowhubError,
	FlowhubNotFoundError,
	FlowhubRateLimitError,
} from "../errors.js";

export interface InternalHttpOptions {
	readonly baseUrl: string;
	readonly timeout: number;
	readonly fetchFn?: typeof fetch | undefined;
}

export interface GraphQLRequest {
	readonly operationName: string;
	readonly variables: Record<string, unknown>;
	readonly query: string;
}

export interface GraphQLResponse<T> {
	readonly data?: T;
	readonly errors?: ReadonlyArray<{ message: string }>;
}

/**
 * Tiny HTTP helper for the dashboard module.
 *
 * Differs from the public-API HttpClient:
 * - Auth token is supplied per-request (not baked into the client) so the
 *   SessionAuth can rotate it independently.
 * - Supports binary downloads (returns Buffer) for CSV reports.
 * - GraphQL helper for login/refresh.
 *
 * No automatic retry: dashboard endpoints are reverse-engineered and we don't
 * want to hammer them.
 */
export class InternalHttp {
	/** Normalised base URL (trailing slashes stripped). Exposed so resources can build receipt-style URLs. */
	readonly baseUrl: string;
	private readonly timeout: number;
	private readonly fetchFn: typeof fetch;

	constructor(options: InternalHttpOptions) {
		this.baseUrl = options.baseUrl.replace(/\/+$/, "");
		this.timeout = options.timeout;
		this.fetchFn = options.fetchFn ?? globalThis.fetch;
	}

	async graphql<T>(request: GraphQLRequest, token?: string, path = "/graph/query"): Promise<T> {
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json",
			Origin: "https://app.flowhub.com",
		};
		if (token) headers.Authorization = token;

		const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
			method: "POST",
			headers,
			body: JSON.stringify(request),
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw this.mapError(response.status, body);
		}

		const parsed = (await response.json()) as GraphQLResponse<T>;
		if (parsed.errors && parsed.errors.length > 0) {
			const message = parsed.errors.map((e) => e.message).join("; ");
			if (/unauthorized|invalid token|expired/i.test(message)) {
				throw new FlowhubAuthError(`GraphQL auth error: ${message}`);
			}
			throw new FlowhubError(`GraphQL error: ${message}`);
		}
		if (!parsed.data) {
			throw new FlowhubError("GraphQL response missing data");
		}
		return parsed.data;
	}

	async downloadBinary(
		path: string,
		query: Record<string, string | number | boolean | undefined>,
		token: string,
		options: { accept?: string } = {},
	): Promise<{ data: Buffer; filename: string | undefined; contentType: string }> {
		const url = this.buildUrl(path, query);
		const response = await this.fetchWithTimeout(url, {
			method: "GET",
			headers: {
				Accept: options.accept ?? "application/octet-stream",
				Authorization: token,
				Origin: "https://app.flowhub.com",
			},
		});

		if (!response.ok) {
			const body = await response.text().catch(() => "");
			throw this.mapError(response.status, body);
		}

		const arrayBuffer = await response.arrayBuffer();
		const filename = this.parseContentDisposition(response.headers.get("content-disposition"));
		const contentType = response.headers.get("content-type") ?? "application/octet-stream";

		return {
			data: Buffer.from(arrayBuffer),
			filename,
			contentType,
		};
	}

	private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);
		try {
			return await this.fetchFn(url, { ...init, signal: controller.signal });
		} catch (err) {
			if (err instanceof DOMException && err.name === "AbortError") {
				throw new FlowhubError("Request timed out", { cause: err });
			}
			if (err instanceof FlowhubError) throw err;
			throw new FlowhubError("Network error", { cause: err });
		} finally {
			clearTimeout(timeoutId);
		}
	}

	private buildUrl(
		path: string,
		query: Record<string, string | number | boolean | undefined>,
	): string {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(`${this.baseUrl}${normalizedPath}`);
		for (const [k, v] of Object.entries(query)) {
			if (v !== undefined) {
				url.searchParams.set(k, String(v));
			}
		}
		return url.toString();
	}

	private parseContentDisposition(header: string | null): string | undefined {
		if (!header) return undefined;
		const match = header.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
		return match?.[1] ? decodeURIComponent(match[1]) : undefined;
	}

	private mapError(status: number, body: string): FlowhubError {
		switch (status) {
			case 401:
			case 403:
				return new FlowhubAuthError(`Authentication failed: ${body || "Unauthorized"}`);
			case 404:
				return new FlowhubNotFoundError(`Resource not found: ${body || "Not Found"}`);
			case 429:
				return new FlowhubRateLimitError(`Rate limited: ${body || "Too Many Requests"}`);
			default:
				return new FlowhubError(`Request failed with status ${status}: ${body}`, {
					statusCode: status,
				});
		}
	}
}
