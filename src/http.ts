import { type FlowhubCredentials, createAuthHeaders } from "./auth.js";
import { DEFAULT_BASE_URL, DEFAULT_RETRIES, DEFAULT_TIMEOUT_MS } from "./constants.js";
import {
	FlowhubAuthError,
	FlowhubError,
	FlowhubNotFoundError,
	FlowhubRateLimitError,
	FlowhubValidationError,
} from "./errors.js";
import {
	DEFAULT_RATE_LIMIT_RPS,
	type RateLimitInfo,
	type RateLimitOptions,
	RateLimiter,
} from "./rate-limiter.js";

/** How retry backoff delays are randomized. */
export type JitterMode = "full" | "equal" | "none";

export interface HttpClientOptions {
	readonly credentials: FlowhubCredentials;
	readonly baseUrl?: string | undefined;
	readonly timeout?: number | undefined;
	readonly retries?: number | undefined;
	readonly fetchFn?: typeof fetch | undefined;
	/** Cap on a single retry backoff delay, in ms. Default 30000. */
	readonly maxDelayMs?: number | undefined;
	/** Backoff randomization. Default `"full"` (full-jitter exponential). */
	readonly jitter?: JitterMode | undefined;
	/** Client-side throttle. Defaults to ~{@link DEFAULT_RATE_LIMIT_RPS} req/s; `{ rps: 0 }` disables. */
	readonly rateLimit?: RateLimitOptions | undefined;
	/** Called whenever the server returns rate-limit headers (success or 429), so callers can self-pace. */
	readonly onRateLimit?: ((info: RateLimitInfo) => void) | undefined;
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
const DEFAULT_MAX_DELAY_MS = 30_000;

export class HttpClient {
	private readonly baseUrl: string;
	private readonly timeout: number;
	private readonly retries: number;
	private readonly credentials: FlowhubCredentials;
	private readonly fetchFn: typeof fetch;
	private readonly maxDelayMs: number;
	private readonly jitter: JitterMode;
	private readonly limiter: RateLimiter | null;
	private readonly onRateLimit: ((info: RateLimitInfo) => void) | undefined;

	constructor(options: HttpClientOptions) {
		this.credentials = options.credentials;
		this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
		this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
		this.retries = options.retries ?? DEFAULT_RETRIES;
		this.fetchFn = options.fetchFn ?? globalThis.fetch;
		this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
		this.jitter = options.jitter ?? "full";
		this.onRateLimit = options.onRateLimit;

		const rps = options.rateLimit?.rps ?? DEFAULT_RATE_LIMIT_RPS;
		this.limiter =
			rps > 0 ? new RateLimiter(rps, options.rateLimit?.burst ?? Math.ceil(rps)) : null;
	}

	async requestText(options: RequestOptions): Promise<string> {
		const url = this.buildUrl(options.path, options.query);
		const headers: Record<string, string> = {
			Accept: "text/plain",
			...createAuthHeaders(this.credentials),
		};

		await this.limiter?.acquire();
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), this.timeout);

		try {
			const response = await this.fetchFn(url, {
				method: options.method ?? "GET",
				headers,
				signal: options.signal ?? controller.signal,
			});

			clearTimeout(timeoutId);
			this.notifyRateLimit(response.headers);

			if (response.ok) {
				return await response.text();
			}

			const errorBody = await response.text().catch(() => "");
			const requestId = response.headers.get("x-request-id") ?? undefined;
			if (response.status === 429) {
				const info = this.readRateLimit(response.headers);
				throw this.rateLimitError(info, errorBody, response.statusText, requestId);
			}
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
		let nextDelayMs = 0;

		for (let attempt = 0; attempt <= this.retries; attempt++) {
			if (attempt > 0) {
				await this.sleep(nextDelayMs);
			}
			await this.limiter?.acquire();

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
				this.notifyRateLimit(response.headers);

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
					const info = this.readRateLimit(response.headers);
					lastError = this.rateLimitError(info, errorBody, response.statusText, requestId);
					nextDelayMs = this.retryDelayMs(attempt + 1, info.retryAfterMs);
				} else {
					lastError = new FlowhubError(
						`Server error ${response.status}: ${errorBody || response.statusText}`,
						{ statusCode: response.status, requestId },
					);
					nextDelayMs = this.retryDelayMs(attempt + 1, undefined);
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

				if (err instanceof FlowhubRateLimitError) {
					lastError = err;
					if (attempt < this.retries) {
						nextDelayMs = this.retryDelayMs(
							attempt + 1,
							err.retryAfter != null ? err.retryAfter * 1000 : undefined,
						);
						continue;
					}
					throw err;
				}

				if (err instanceof FlowhubError) {
					lastError = err;
					if (attempt < this.retries) {
						nextDelayMs = this.retryDelayMs(attempt + 1, undefined);
						continue;
					}
					throw err;
				}

				if (err instanceof DOMException && err.name === "AbortError") {
					lastError = new FlowhubError("Request timed out", { cause: err });
					if (attempt < this.retries) {
						nextDelayMs = this.retryDelayMs(attempt + 1, undefined);
						continue;
					}
					throw lastError;
				}

				lastError = new FlowhubError("Network error", { cause: err });
				nextDelayMs = this.retryDelayMs(attempt + 1, undefined);
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

	/**
	 * Read rate-limit signals from response headers. Handles `Retry-After`
	 * (delta-seconds or HTTP-date), `Retry-After-Ms`, and the de-facto
	 * `X-RateLimit-*` / `RateLimit-*` families (`-Limit`, `-Remaining`,
	 * `-Reset` as epoch-seconds or delta-seconds, `-Reset-After` as delta-seconds).
	 */
	private readRateLimit(headers: Headers): RateLimitInfo {
		const num = (v: string | null): number | undefined => {
			if (v == null) return undefined;
			const n = Number(v);
			return Number.isFinite(n) ? n : undefined;
		};
		const limit = num(headers.get("x-ratelimit-limit") ?? headers.get("ratelimit-limit"));
		const remaining = num(
			headers.get("x-ratelimit-remaining") ?? headers.get("ratelimit-remaining"),
		);
		const retryAfterMs = this.parseRetryAfterMs(headers);

		let resetAt: number | undefined;
		const resetRaw = headers.get("x-ratelimit-reset") ?? headers.get("ratelimit-reset");
		if (resetRaw != null) {
			const n = Number(resetRaw);
			if (Number.isFinite(n)) {
				// Heuristic: large values are epoch seconds; small ones are deltas.
				resetAt = n > 1e7 ? n * 1000 : Date.now() + n * 1000;
			} else {
				const d = Date.parse(resetRaw);
				if (!Number.isNaN(d)) resetAt = d;
			}
		}
		if (resetAt == null && retryAfterMs != null) resetAt = Date.now() + retryAfterMs;

		return { limit, remaining, resetAt, retryAfterMs };
	}

	private parseRetryAfterMs(headers: Headers): number | undefined {
		const ms = headers.get("retry-after-ms");
		if (ms != null) {
			const n = Number(ms);
			if (Number.isFinite(n)) return Math.max(0, n);
		}
		const retryAfter = headers.get("retry-after");
		if (retryAfter != null) {
			const seconds = Number(retryAfter);
			if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
			const date = Date.parse(retryAfter);
			if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
		}
		const resetAfter =
			headers.get("x-ratelimit-reset-after") ?? headers.get("ratelimit-reset-after");
		if (resetAfter != null) {
			const n = Number(resetAfter);
			if (Number.isFinite(n)) return Math.max(0, n * 1000);
		}
		return undefined;
	}

	private notifyRateLimit(headers: Headers): void {
		if (!this.onRateLimit) return;
		const info = this.readRateLimit(headers);
		if (
			info.limit != null ||
			info.remaining != null ||
			info.resetAt != null ||
			info.retryAfterMs != null
		) {
			this.onRateLimit(info);
		}
	}

	private rateLimitError(
		info: RateLimitInfo,
		body: string,
		statusText: string,
		requestId: string | undefined,
	): FlowhubRateLimitError {
		return new FlowhubRateLimitError(`Rate limited: ${body || statusText}`, {
			retryAfter: info.retryAfterMs != null ? Math.ceil(info.retryAfterMs / 1000) : undefined,
			requestId,
			limit: info.limit,
			remaining: info.remaining,
			resetAt: info.resetAt,
		});
	}

	/** Delay before the next attempt: honor a server-provided wait, else jittered backoff. */
	private retryDelayMs(attempt: number, retryAfterMs: number | undefined): number {
		if (retryAfterMs != null) return Math.min(retryAfterMs, this.maxDelayMs);
		return this.calculateDelay(attempt);
	}

	private calculateDelay(attempt: number): number {
		const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), this.maxDelayMs);
		if (this.jitter === "none") return Math.floor(exponential);
		if (this.jitter === "equal") {
			return Math.floor(exponential / 2 + Math.random() * (exponential / 2));
		}
		return Math.floor(Math.random() * exponential);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}
