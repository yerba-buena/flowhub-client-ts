interface FlowhubErrorOptions {
    statusCode?: number | undefined;
    requestId?: string | undefined;
    cause?: unknown;
}
declare class FlowhubError extends Error {
    readonly statusCode: number | undefined;
    readonly requestId: string | undefined;
    constructor(message: string, options?: FlowhubErrorOptions);
}
declare class FlowhubAuthError extends FlowhubError {
    constructor(message: string, options?: {
        requestId?: string | undefined;
        cause?: unknown;
    });
}
interface FlowhubRateLimitErrorOptions {
    retryAfter?: number | undefined;
    requestId?: string | undefined;
    /** Value of `X-RateLimit-Limit` / `RateLimit-Limit`, if the server sent it. */
    limit?: number | undefined;
    /** Value of `X-RateLimit-Remaining` / `RateLimit-Remaining`, if present. */
    remaining?: number | undefined;
    /** Epoch milliseconds when the rate-limit window resets, if derivable. */
    resetAt?: number | undefined;
    cause?: unknown;
}
declare class FlowhubRateLimitError extends FlowhubError {
    /** Suggested wait before retrying, in **seconds** (rounded), if known. */
    readonly retryAfter: number | undefined;
    readonly limit: number | undefined;
    readonly remaining: number | undefined;
    readonly resetAt: number | undefined;
    constructor(message: string, options?: FlowhubRateLimitErrorOptions);
}
declare class FlowhubNotFoundError extends FlowhubError {
    constructor(message: string, options?: {
        requestId?: string | undefined;
        cause?: unknown;
    });
}
declare class FlowhubValidationError extends FlowhubError {
    readonly errors: readonly string[];
    constructor(message: string, options?: {
        errors?: string[] | undefined;
        requestId?: string | undefined;
        cause?: unknown;
    });
}

export { FlowhubAuthError as F, FlowhubError as a, FlowhubNotFoundError as b, FlowhubRateLimitError as c, FlowhubValidationError as d };
