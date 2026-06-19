/**
 * Client-side rate limiting for the public Flowhub API.
 *
 * Flowhub enforces a request-rate limit (downstream apps have observed ~59
 * req/s, returning HTTP 429; the exact figure/scope is not published). To avoid
 * tripping it, {@link HttpClient} runs every outbound request through a shared
 * token-bucket limiter. It is configurable and can be disabled.
 */

export interface RateLimitOptions {
	/**
	 * Sustained requests per second. Pass `0` (or a negative number) to disable
	 * client-side throttling entirely. Defaults to {@link DEFAULT_RATE_LIMIT_RPS}.
	 */
	readonly rps?: number | undefined;
	/**
	 * Maximum burst — the token-bucket capacity. Defaults to `ceil(rps)`, i.e.
	 * up to one second's worth of requests may fire back-to-back before the
	 * limiter starts pacing.
	 */
	readonly burst?: number | undefined;
}

/** Rate-limit signal surfaced from response headers, when the server sends them. */
export interface RateLimitInfo {
	/** `X-RateLimit-Limit` / `RateLimit-Limit`, if present. */
	readonly limit?: number | undefined;
	/** `X-RateLimit-Remaining` / `RateLimit-Remaining`, if present. */
	readonly remaining?: number | undefined;
	/** Epoch milliseconds when the window resets, if derivable. */
	readonly resetAt?: number | undefined;
	/** Suggested wait before retrying, in milliseconds, if the server indicated one. */
	readonly retryAfterMs?: number | undefined;
}

/**
 * Conservative default request rate. Set below the ~59 req/s that downstream
 * apps have observed Flowhub rejecting, leaving headroom for bursts and other
 * clients sharing the same API key. Override via `rateLimit.rps`.
 */
export const DEFAULT_RATE_LIMIT_RPS = 45;

/**
 * A simple FIFO token-bucket limiter. `tokens` refill continuously at `rps` up
 * to `capacity`; `acquire()` resolves as soon as a token is available, in call
 * order. Disabled buckets (`rps <= 0`) are represented by a null limiter in
 * `HttpClient`, not by this class.
 */
export class RateLimiter {
	private tokens: number;
	private lastRefillMs: number;
	private readonly waiters: Array<() => void> = [];
	private timer: ReturnType<typeof setTimeout> | null = null;

	constructor(
		private readonly rps: number,
		private readonly capacity: number,
	) {
		if (rps <= 0) throw new Error("RateLimiter requires rps > 0");
		this.tokens = capacity;
		this.lastRefillMs = Date.now();
	}

	/** Resolves when a token is available (immediately if the bucket isn't empty). */
	acquire(): Promise<void> {
		return new Promise<void>((resolve) => {
			this.waiters.push(resolve);
			this.process();
		});
	}

	private refill(): void {
		const now = Date.now();
		const elapsedSec = (now - this.lastRefillMs) / 1000;
		if (elapsedSec > 0) {
			this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.rps);
			this.lastRefillMs = now;
		}
	}

	private process(): void {
		this.refill();
		while (this.tokens >= 1 && this.waiters.length > 0) {
			this.tokens -= 1;
			const resolve = this.waiters.shift();
			resolve?.();
		}
		if (this.waiters.length > 0 && this.timer == null) {
			const needed = 1 - this.tokens;
			const waitMs = Math.max(1, Math.ceil((needed / this.rps) * 1000));
			this.timer = setTimeout(() => {
				this.timer = null;
				this.process();
			}, waitMs);
		}
	}
}
