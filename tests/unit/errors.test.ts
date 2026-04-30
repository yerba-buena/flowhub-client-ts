import { describe, expect, it } from "vitest";
import {
	FlowhubAuthError,
	FlowhubError,
	FlowhubNotFoundError,
	FlowhubRateLimitError,
	FlowhubValidationError,
} from "../../src/errors.js";

describe("FlowhubError", () => {
	it("is an instance of Error", () => {
		const err = new FlowhubError("test");
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(FlowhubError);
	});

	it("sets name, message, statusCode, requestId", () => {
		const err = new FlowhubError("fail", { statusCode: 500, requestId: "req-1" });
		expect(err.name).toBe("FlowhubError");
		expect(err.message).toBe("fail");
		expect(err.statusCode).toBe(500);
		expect(err.requestId).toBe("req-1");
	});

	it("propagates cause", () => {
		const cause = new Error("root");
		const err = new FlowhubError("wrapped", { cause });
		expect(err.cause).toBe(cause);
	});
});

describe("FlowhubAuthError", () => {
	it("extends FlowhubError with statusCode 401", () => {
		const err = new FlowhubAuthError("unauthorized");
		expect(err).toBeInstanceOf(FlowhubError);
		expect(err).toBeInstanceOf(Error);
		expect(err.name).toBe("FlowhubAuthError");
		expect(err.statusCode).toBe(401);
	});
});

describe("FlowhubRateLimitError", () => {
	it("extends FlowhubError with statusCode 429 and retryAfter", () => {
		const err = new FlowhubRateLimitError("slow down", { retryAfter: 30 });
		expect(err).toBeInstanceOf(FlowhubError);
		expect(err.name).toBe("FlowhubRateLimitError");
		expect(err.statusCode).toBe(429);
		expect(err.retryAfter).toBe(30);
	});

	it("retryAfter is undefined when not provided", () => {
		const err = new FlowhubRateLimitError("slow down");
		expect(err.retryAfter).toBeUndefined();
	});
});

describe("FlowhubNotFoundError", () => {
	it("extends FlowhubError with statusCode 404", () => {
		const err = new FlowhubNotFoundError("gone");
		expect(err).toBeInstanceOf(FlowhubError);
		expect(err.name).toBe("FlowhubNotFoundError");
		expect(err.statusCode).toBe(404);
	});
});

describe("FlowhubValidationError", () => {
	it("extends FlowhubError with statusCode 422 and frozen errors", () => {
		const err = new FlowhubValidationError("bad input", {
			errors: ["field required"],
		});
		expect(err).toBeInstanceOf(FlowhubError);
		expect(err.name).toBe("FlowhubValidationError");
		expect(err.statusCode).toBe(422);
		expect(err.errors).toEqual(["field required"]);
		expect(Object.isFrozen(err.errors)).toBe(true);
	});

	it("defaults errors to empty frozen array", () => {
		const err = new FlowhubValidationError("bad");
		expect(err.errors).toEqual([]);
		expect(Object.isFrozen(err.errors)).toBe(true);
	});
});
