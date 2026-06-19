import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { RateLimiter } from "../../src/rate-limiter.js";

describe("RateLimiter", () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	it("allows a burst up to capacity immediately, then paces the rest", async () => {
		const rl = new RateLimiter(10, 2); // 10 req/s, burst 2 → 1 token per 100ms
		const done: number[] = [];
		rl.acquire().then(() => done.push(1));
		rl.acquire().then(() => done.push(2));
		rl.acquire().then(() => done.push(3));

		// Two tokens available up front; the third must wait.
		await vi.advanceTimersByTimeAsync(0);
		expect(done).toEqual([1, 2]);

		await vi.advanceTimersByTimeAsync(99);
		expect(done).toEqual([1, 2]);

		await vi.advanceTimersByTimeAsync(1); // 100ms total → +1 token
		expect(done).toEqual([1, 2, 3]);
	});

	it("preserves FIFO order across paced acquisitions", async () => {
		const rl = new RateLimiter(20, 1); // burst 1 → 50ms apart
		const done: number[] = [];
		for (let i = 0; i < 4; i++) rl.acquire().then(() => done.push(i));

		await vi.advanceTimersByTimeAsync(0);
		expect(done).toEqual([0]);
		await vi.advanceTimersByTimeAsync(50);
		expect(done).toEqual([0, 1]);
		await vi.advanceTimersByTimeAsync(100);
		expect(done).toEqual([0, 1, 2, 3]);
	});

	it("throws when constructed with rps <= 0", () => {
		expect(() => new RateLimiter(0, 1)).toThrow();
		expect(() => new RateLimiter(-5, 1)).toThrow();
	});
});
