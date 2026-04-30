export interface FlowhubErrorOptions {
	statusCode?: number | undefined;
	requestId?: string | undefined;
	cause?: unknown;
}

export class FlowhubError extends Error {
	readonly statusCode: number | undefined;
	readonly requestId: string | undefined;

	constructor(message: string, options?: FlowhubErrorOptions) {
		super(message, { cause: options?.cause });
		this.name = "FlowhubError";
		this.statusCode = options?.statusCode;
		this.requestId = options?.requestId;
	}
}

export class FlowhubAuthError extends FlowhubError {
	constructor(message: string, options?: { requestId?: string | undefined; cause?: unknown }) {
		super(message, { statusCode: 401, requestId: options?.requestId, cause: options?.cause });
		this.name = "FlowhubAuthError";
	}
}

export interface FlowhubRateLimitErrorOptions {
	retryAfter?: number | undefined;
	requestId?: string | undefined;
	cause?: unknown;
}

export class FlowhubRateLimitError extends FlowhubError {
	readonly retryAfter: number | undefined;

	constructor(message: string, options?: FlowhubRateLimitErrorOptions) {
		super(message, { statusCode: 429, requestId: options?.requestId, cause: options?.cause });
		this.name = "FlowhubRateLimitError";
		this.retryAfter = options?.retryAfter;
	}
}

export class FlowhubNotFoundError extends FlowhubError {
	constructor(message: string, options?: { requestId?: string | undefined; cause?: unknown }) {
		super(message, { statusCode: 404, requestId: options?.requestId, cause: options?.cause });
		this.name = "FlowhubNotFoundError";
	}
}

export class FlowhubValidationError extends FlowhubError {
	readonly errors: readonly string[];

	constructor(
		message: string,
		options?: {
			errors?: string[] | undefined;
			requestId?: string | undefined;
			cause?: unknown;
		},
	) {
		super(message, { statusCode: 422, requestId: options?.requestId, cause: options?.cause });
		this.name = "FlowhubValidationError";
		this.errors = Object.freeze(options?.errors ?? []);
	}
}
