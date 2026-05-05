import { type FlowhubCredentials, createAuthHeaders } from "./auth.js";
import { DEFAULT_BASE_URL, DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS } from "./constants.js";
import {
	FlowhubAuthError,
	FlowhubError,
	FlowhubNotFoundError,
	FlowhubRateLimitError,
	FlowhubValidationError,
} from "./errors.js";

export interface HttpClientOptions {
	readonly credentials: FlowhubCredentials;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
	readonly retries?: number | undefined;
	readonly fetchFn?: typeof fetch | undefined;
}

export interface RequestOptions {
	readonly method?: string | undefined;
	readonly path: string;
	readonly query?: Record<string, string | number | boolean | undefined> | undefined;
	readonly body?: unknown;
	readonly signal?: AbortSignal | undefined;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 502, 503, 504]);
const BASE_DELAY_MS = 500;
const MAX_DELAY_MS = 30_000;

export class HttpClient {
	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly retries: number;
	private readonly credentials: FlowhubCredentials;
	private readonly fetchFn: typeof fetch;

	constructor(options: HttpClientOptions) {
		this.credentials = options.credentials;
		this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
		this.retries = options.retries ?? DEFAULT_RETRIES;
		this.fetchFn = options.fetchFn ?? globalThis.fetch;
	}

	async requestText(options: RequestOptions): Promise<string> {
		const url = this.buildUrl(options.path, options.query);
		const headers: Record<string, string> = {
			Accept: "text/plain",
			...createAuthHeaders(this.credentials),
		};

		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await this.fetchFn(url, {
				method: options.method ?? "GET",
				headers,
				signal: options.signal ?? controller.signal,
			});

			clearTimeout(timeoutId);

			if (response.ok) {
				return await response.text();
			}

			const errorBody = await response.text().catch(() => "");
			const requestId = response.headers.get("x-request-id") ?? undefined;
			throw this.mapError(response.status, errorBody, requestId);
		} catch (err) {
			clearTimeout(timeoutId);
			if (err instanceof FlowhubError) throw err;
			if (err instanceof DOMException && err.name === "AbortError") {
				throw new FlowhubError("Request timed out", { cause: err });
			}
			throw new FlowhubError("Network error", { cause: err });
		}
	}

	async request<T>(options: RequestOptions): Promise<T> {
		const url = this.buildUrl(options.path, options.query);
		const headers: Record<string, string> = {
			"Content-Type": "application/json",
			Accept: "application/json",
			...createAuthHeaders(this.credentials),
		};

		const method = options.method ?? "GET";
		let lastError: Error | undefined;

		for (let attempt = 0; attempt <= this.retries; attempt++) {
			if (attempt > 0) {
				const delay = this.calculateDelay(attempt);
				await this.sleep(delay);
			}

			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), this.timeout);

			try {
				const response = await this.fetchFn(url, {
					method,
					headers,
					body: options.body != null ? JSON.stringify(options.body) : null,
					signal: options.signal ?? controller.signal,
				});

				clearTimeout(timeoutId);

				if (response.ok) {
					if (response.status === 204) {
						return undefined as T;
					}
					return (await response.json()) as T;
				}

				const errorBody = await response.text().catch(() => "");
				const requestId = response.headers.get("x-request-id") ?? undefined;

				if (!RETRYABLE_STATUS_CODES.has(response.status)) {
					throw this.mapError(response.status, errorBody, requestId);
				}

				if (response.status === 429) {
					const retryAfter = this.parseRetryAfter(response.headers.get("retry-after"));
					lastError = new FlowhubRateLimitError(
						`Rate limited: ${errorBody || response.statusText}`,
						{ retryAfter, requestId },
					);
					if (retryAfter != null && attempt < this.retries) {
						await this.sleep(retryAfter * 1000);
					}
				} else {
					lastError = new FlowhubError(
						`Server error ${response.status}: ${errorBody || response.statusText}`,
						{ statusCode: response.status, requestId },
					);
				}
			} catch (err) {
				clearTimeout(timeoutId);

				if (
					err instanceof FlowhubAuthError ||
					err instanceof FlowhubNotFoundError ||
					err instanceof FlowhubValidationError
				) {
					throw err;
				}

				if (err instanceof FlowhubRateLimitError || err instanceof FlowhubError) {
					lastError = err;
					if (attempt < this.retries) continue;
					throw err;
				}

				if (err instanceof DOMException && err.name === "AbortError") {
					lastError = new FlowhubError("Request timed out", { cause: err });
					if (attempt < this.retries) continue;
					throw lastError;
				}

				lastError = new FlowhubError("Network error", { cause: err });
				if (attempt < this.retries) continue;
			}
		}

		throw lastError ?? new FlowhubError("Request failed after retries");
	}

	private buildUrl(
		path: string,
		query?: Record<string, string | number | boolean | undefined>,
	): string {
		const normalizedPath = path.startsWith("/") ? path : `/${path}`;
		const url = new URL(`${this.baseUrl}${normalizedPath}`);

		if (query) {
			for (const [k, v] of Object.entries(query)) {
				if (v !== undefined) {
					url.searchParams.set(k, String(v));
				}
			}
		}

		return url.toString();
	}

	private mapError(status: number, body: string, requestId: string | undefined): FlowhubError {
		switch (status) {
			case 401:
			case 403:
				return new FlowhubAuthError(`Authentication failed: ${body || "Unauthorized"}`, {
					requestId,
				});
			case 404:
				return new FlowhubNotFoundError(`Resource not found: ${body || "Not Found"}`, {
					requestId,
				});
			case 422: {
				let errors: string[] = [];
				try {
					const parsed = JSON.parse(body);
					if (Array.isArray(parsed.errors)) {
						errors = parsed.errors;
					}
				} catch {}
				return new FlowhubValidationError(`Validation failed: ${body || "Unprocessable"}`, {
					errors,
					requestId,
				});
			}
			default:
				return new FlowhubError(`Request failed with status ${status}: ${body}`, {
					statusCode: status,
					requestId,
				});
		}
	}

	private parseRetryAfter(header: string | null): number | undefined {
		if (header == null) return undefined;
		const seconds = Number(header);
		if (!Number.isNaN(seconds)) return seconds;
		const date = Date.parse(header);
		if (!Number.isNaN(date)) return Math.max(0, Math.ceil((date - Date.now()) / 1000));
		return undefined;
	}

	private calculateDelay(attempt: number): number {
		const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), MAX_DELAY_MS);
		const jitter = Math.random() * exponential;
		return Math.floor(exponential / 2 + jitter);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
