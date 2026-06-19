// src/auth.ts
function createAuthHeaders(credentials) {
  if (credentials.accessToken) {
    return { Authorization: `Bearer ${credentials.accessToken}` };
  }
  return {
    clientId: credentials.clientId,
    key: credentials.apiKey
  };
}

// src/constants.ts
var DEFAULT_BASE_URL = "https://api.flowhub.co";
var DEFAULT_TIMEOUT_MS = 3e4;
var DEFAULT_RETRIES = 3;
var DOCS_SNAPSHOT_DATE = "2026-05-07";

// src/errors.ts
var FlowhubError = class extends Error {
  statusCode;
  requestId;
  constructor(message, options) {
    super(message, { cause: options?.cause });
    this.name = "FlowhubError";
    this.statusCode = options?.statusCode;
    this.requestId = options?.requestId;
  }
};
var FlowhubAuthError = class extends FlowhubError {
  constructor(message, options) {
    super(message, { statusCode: 401, requestId: options?.requestId, cause: options?.cause });
    this.name = "FlowhubAuthError";
  }
};
var FlowhubRateLimitError = class extends FlowhubError {
  /** Suggested wait before retrying, in **seconds** (rounded), if known. */
  retryAfter;
  limit;
  remaining;
  resetAt;
  constructor(message, options) {
    super(message, { statusCode: 429, requestId: options?.requestId, cause: options?.cause });
    this.name = "FlowhubRateLimitError";
    this.retryAfter = options?.retryAfter;
    this.limit = options?.limit;
    this.remaining = options?.remaining;
    this.resetAt = options?.resetAt;
  }
};
var FlowhubNotFoundError = class extends FlowhubError {
  constructor(message, options) {
    super(message, { statusCode: 404, requestId: options?.requestId, cause: options?.cause });
    this.name = "FlowhubNotFoundError";
  }
};
var FlowhubValidationError = class extends FlowhubError {
  errors;
  constructor(message, options) {
    super(message, { statusCode: 422, requestId: options?.requestId, cause: options?.cause });
    this.name = "FlowhubValidationError";
    this.errors = Object.freeze(options?.errors ?? []);
  }
};

// src/rate-limiter.ts
var DEFAULT_RATE_LIMIT_RPS = 45;
var RateLimiter = class {
  constructor(rps, capacity) {
    this.rps = rps;
    this.capacity = capacity;
    if (rps <= 0) throw new Error("RateLimiter requires rps > 0");
    this.tokens = capacity;
    this.lastRefillMs = Date.now();
  }
  rps;
  capacity;
  tokens;
  lastRefillMs;
  waiters = [];
  timer = null;
  /** Resolves when a token is available (immediately if the bucket isn't empty). */
  acquire() {
    return new Promise((resolve) => {
      this.waiters.push(resolve);
      this.process();
    });
  }
  refill() {
    const now = Date.now();
    const elapsedSec = (now - this.lastRefillMs) / 1e3;
    if (elapsedSec > 0) {
      this.tokens = Math.min(this.capacity, this.tokens + elapsedSec * this.rps);
      this.lastRefillMs = now;
    }
  }
  process() {
    this.refill();
    while (this.tokens >= 1 && this.waiters.length > 0) {
      this.tokens -= 1;
      const resolve = this.waiters.shift();
      resolve?.();
    }
    if (this.waiters.length > 0 && this.timer == null) {
      const needed = 1 - this.tokens;
      const waitMs = Math.max(1, Math.ceil(needed / this.rps * 1e3));
      this.timer = setTimeout(() => {
        this.timer = null;
        this.process();
      }, waitMs);
    }
  }
};

// src/http.ts
var RETRYABLE_STATUS_CODES = /* @__PURE__ */ new Set([429, 500, 502, 503, 504]);
var BASE_DELAY_MS = 500;
var DEFAULT_MAX_DELAY_MS = 3e4;
var HttpClient = class {
  baseUrl;
  timeout;
  retries;
  credentials;
  fetchFn;
  maxDelayMs;
  jitter;
  limiter;
  onRateLimit;
  constructor(options) {
    this.credentials = options.credentials;
    this.baseUrl = (options.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.timeout = options.timeout ?? DEFAULT_TIMEOUT_MS;
    this.retries = options.retries ?? DEFAULT_RETRIES;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
    this.maxDelayMs = options.maxDelayMs ?? DEFAULT_MAX_DELAY_MS;
    this.jitter = options.jitter ?? "full";
    this.onRateLimit = options.onRateLimit;
    const rps = options.rateLimit?.rps ?? DEFAULT_RATE_LIMIT_RPS;
    this.limiter = rps > 0 ? new RateLimiter(rps, options.rateLimit?.burst ?? Math.ceil(rps)) : null;
  }
  async requestText(options) {
    const url = this.buildUrl(options.path, options.query);
    const headers = {
      Accept: "text/plain",
      ...createAuthHeaders(this.credentials)
    };
    await this.limiter?.acquire();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);
    try {
      const response = await this.fetchFn(url, {
        method: options.method ?? "GET",
        headers,
        signal: options.signal ?? controller.signal
      });
      clearTimeout(timeoutId);
      this.notifyRateLimit(response.headers);
      if (response.ok) {
        return await response.text();
      }
      const errorBody = await response.text().catch(() => "");
      const requestId = response.headers.get("x-request-id") ?? void 0;
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
  async request(options) {
    const url = this.buildUrl(options.path, options.query);
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      ...createAuthHeaders(this.credentials)
    };
    const method = options.method ?? "GET";
    let lastError;
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
          signal: options.signal ?? controller.signal
        });
        clearTimeout(timeoutId);
        this.notifyRateLimit(response.headers);
        if (response.ok) {
          if (response.status === 204) {
            return void 0;
          }
          return await response.json();
        }
        const errorBody = await response.text().catch(() => "");
        const requestId = response.headers.get("x-request-id") ?? void 0;
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
            { statusCode: response.status, requestId }
          );
          nextDelayMs = this.retryDelayMs(attempt + 1, void 0);
        }
      } catch (err) {
        clearTimeout(timeoutId);
        if (err instanceof FlowhubAuthError || err instanceof FlowhubNotFoundError || err instanceof FlowhubValidationError) {
          throw err;
        }
        if (err instanceof FlowhubRateLimitError) {
          lastError = err;
          if (attempt < this.retries) {
            nextDelayMs = this.retryDelayMs(
              attempt + 1,
              err.retryAfter != null ? err.retryAfter * 1e3 : void 0
            );
            continue;
          }
          throw err;
        }
        if (err instanceof FlowhubError) {
          lastError = err;
          if (attempt < this.retries) {
            nextDelayMs = this.retryDelayMs(attempt + 1, void 0);
            continue;
          }
          throw err;
        }
        if (err instanceof DOMException && err.name === "AbortError") {
          lastError = new FlowhubError("Request timed out", { cause: err });
          if (attempt < this.retries) {
            nextDelayMs = this.retryDelayMs(attempt + 1, void 0);
            continue;
          }
          throw lastError;
        }
        lastError = new FlowhubError("Network error", { cause: err });
        nextDelayMs = this.retryDelayMs(attempt + 1, void 0);
        if (attempt < this.retries) continue;
      }
    }
    throw lastError ?? new FlowhubError("Request failed after retries");
  }
  buildUrl(path, query) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);
    if (query) {
      for (const [k, v] of Object.entries(query)) {
        if (v !== void 0) {
          url.searchParams.set(k, String(v));
        }
      }
    }
    return url.toString();
  }
  mapError(status, body, requestId) {
    switch (status) {
      case 401:
      case 403:
        return new FlowhubAuthError(`Authentication failed: ${body || "Unauthorized"}`, {
          requestId
        });
      case 404:
        return new FlowhubNotFoundError(`Resource not found: ${body || "Not Found"}`, {
          requestId
        });
      case 422: {
        let errors = [];
        try {
          const parsed = JSON.parse(body);
          if (Array.isArray(parsed.errors)) {
            errors = parsed.errors;
          }
        } catch {
        }
        return new FlowhubValidationError(`Validation failed: ${body || "Unprocessable"}`, {
          errors,
          requestId
        });
      }
      default:
        return new FlowhubError(`Request failed with status ${status}: ${body}`, {
          statusCode: status,
          requestId
        });
    }
  }
  /**
   * Read rate-limit signals from response headers. Handles `Retry-After`
   * (delta-seconds or HTTP-date), `Retry-After-Ms`, and the de-facto
   * `X-RateLimit-*` / `RateLimit-*` families (`-Limit`, `-Remaining`,
   * `-Reset` as epoch-seconds or delta-seconds, `-Reset-After` as delta-seconds).
   */
  readRateLimit(headers) {
    const num = (v) => {
      if (v == null) return void 0;
      const n = Number(v);
      return Number.isFinite(n) ? n : void 0;
    };
    const limit = num(headers.get("x-ratelimit-limit") ?? headers.get("ratelimit-limit"));
    const remaining = num(
      headers.get("x-ratelimit-remaining") ?? headers.get("ratelimit-remaining")
    );
    const retryAfterMs = this.parseRetryAfterMs(headers);
    let resetAt;
    const resetRaw = headers.get("x-ratelimit-reset") ?? headers.get("ratelimit-reset");
    if (resetRaw != null) {
      const n = Number(resetRaw);
      if (Number.isFinite(n)) {
        resetAt = n > 1e7 ? n * 1e3 : Date.now() + n * 1e3;
      } else {
        const d = Date.parse(resetRaw);
        if (!Number.isNaN(d)) resetAt = d;
      }
    }
    if (resetAt == null && retryAfterMs != null) resetAt = Date.now() + retryAfterMs;
    return { limit, remaining, resetAt, retryAfterMs };
  }
  parseRetryAfterMs(headers) {
    const ms = headers.get("retry-after-ms");
    if (ms != null) {
      const n = Number(ms);
      if (Number.isFinite(n)) return Math.max(0, n);
    }
    const retryAfter = headers.get("retry-after");
    if (retryAfter != null) {
      const seconds = Number(retryAfter);
      if (Number.isFinite(seconds)) return Math.max(0, seconds * 1e3);
      const date = Date.parse(retryAfter);
      if (!Number.isNaN(date)) return Math.max(0, date - Date.now());
    }
    const resetAfter = headers.get("x-ratelimit-reset-after") ?? headers.get("ratelimit-reset-after");
    if (resetAfter != null) {
      const n = Number(resetAfter);
      if (Number.isFinite(n)) return Math.max(0, n * 1e3);
    }
    return void 0;
  }
  notifyRateLimit(headers) {
    if (!this.onRateLimit) return;
    const info = this.readRateLimit(headers);
    if (info.limit != null || info.remaining != null || info.resetAt != null || info.retryAfterMs != null) {
      this.onRateLimit(info);
    }
  }
  rateLimitError(info, body, statusText, requestId) {
    return new FlowhubRateLimitError(`Rate limited: ${body || statusText}`, {
      retryAfter: info.retryAfterMs != null ? Math.ceil(info.retryAfterMs / 1e3) : void 0,
      requestId,
      limit: info.limit,
      remaining: info.remaining,
      resetAt: info.resetAt
    });
  }
  /** Delay before the next attempt: honor a server-provided wait, else jittered backoff. */
  retryDelayMs(attempt, retryAfterMs) {
    if (retryAfterMs != null) return Math.min(retryAfterMs, this.maxDelayMs);
    return this.calculateDelay(attempt);
  }
  calculateDelay(attempt) {
    const exponential = Math.min(BASE_DELAY_MS * 2 ** (attempt - 1), this.maxDelayMs);
    if (this.jitter === "none") return Math.floor(exponential);
    if (this.jitter === "equal") {
      return Math.floor(exponential / 2 + Math.random() * (exponential / 2));
    }
    return Math.floor(Math.random() * exponential);
  }
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
};

// src/resources/auth-token.ts
var AUTH0_BASE_URL = "https://flowhub.auth0.com";
var AuthTokenResource = class {
  fetchFn;
  constructor(fetchFn) {
    this.fetchFn = fetchFn ?? globalThis.fetch;
  }
  /**
   * POST /oauth/token — Obtain an OAuth2 access token from Auth0.
   *
   * This endpoint is on the Auth0 domain (flowhub.auth0.com), not the main
   * Flowhub API. The returned access_token can be passed as the `accessToken`
   * option when constructing a FlowhubClient to use Order Ahead endpoints.
   */
  async getToken(params) {
    const response = await this.fetchFn(`${AUTH0_BASE_URL}/oauth/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new Error(`OAuth token request failed (${response.status}): ${body}`);
    }
    return await response.json();
  }
};

// src/resources/inventory.ts
function buildAnalyticsQuery(params) {
  if (!params?.includesNotForSaleQuantity) return {};
  return { includesNotForSaleQuantity: params.includesNotForSaleQuantity };
}
var InventoryResource = class {
  constructor(http, locationId) {
    this.http = http;
    this.scopedLocationId = locationId;
  }
  http;
  scopedLocationId;
  inventoryPath(suffix, scopedSuffix) {
    if (this.scopedLocationId) {
      return `/v0/locations/${this.scopedLocationId}/${scopedSuffix ?? suffix}`;
    }
    return `/v0/${suffix}`;
  }
  // ── Global (all-locations) endpoints ──────────────────────────────
  // When this resource is scoped via forLocation(), these automatically
  // use the /v0/locations/{locationId}/... paths instead.
  async list() {
    return this.http.request({
      path: this.inventoryPath("inventory")
    });
  }
  async listNonZero() {
    return this.http.request({
      path: this.inventoryPath("inventoryNonZero")
    });
  }
  async listByRoomsNonZero() {
    return this.http.request({
      path: this.inventoryPath("inventoryByRoomsNonZero")
    });
  }
  async listAnalytics(params) {
    return this.http.request({
      path: this.inventoryPath("inventoryAnalytics", "InventoryAnalytics"),
      query: buildAnalyticsQuery(params)
    });
  }
  async listAnalyticsByRooms(params) {
    return this.http.request({
      path: this.inventoryPath("inventoryAnalyticsByRooms", "InventoryAnalyticsByRooms"),
      query: buildAnalyticsQuery(params)
    });
  }
  // ── Per-location endpoints ────────────────────────────────────────
  async listByLocation(locationId) {
    return this.http.request({
      path: `/v0/locations/${locationId}/inventory`
    });
  }
  async listByLocationNonZero(locationId) {
    return this.http.request({
      path: `/v0/locations/${locationId}/inventoryNonZero`
    });
  }
  async listByLocationByRoomsNonZero(locationId) {
    return this.http.request({
      path: `/v0/locations/${locationId}/inventoryByRoomsNonZero`
    });
  }
  async listAnalyticsByLocation(locationId, params) {
    return this.http.request({
      path: `/v0/locations/${locationId}/InventoryAnalytics`,
      query: buildAnalyticsQuery(params)
    });
  }
  async listAnalyticsByLocationByRooms(locationId, params) {
    return this.http.request({
      path: `/v0/locations/${locationId}/InventoryAnalyticsByRooms`,
      query: buildAnalyticsQuery(params)
    });
  }
};

// src/resources/locations.ts
var LocationsResource = class {
  constructor(http) {
    this.http = http;
  }
  http;
  async list() {
    return this.http.request({
      path: "/v0/clientsLocations"
    });
  }
};

// src/resources/order-ahead.ts
var OrderAheadResource = class {
  constructor(http) {
    this.http = http;
  }
  http;
  /** POST /order-ahead/v0/create — Submit a new order ahead */
  async create(params) {
    return this.http.request({
      method: "POST",
      path: "/order-ahead/v0/create",
      body: params
    });
  }
  /** PATCH /orders/{orderId} — Update an existing order */
  async update(orderId, params) {
    return this.http.request({
      method: "PATCH",
      path: `/orders/${orderId}`,
      body: params
    });
  }
  /** POST /orderPostback/{orderId} — Trigger order postback (returns 204) */
  async postback(orderId) {
    await this.http.request({
      method: "POST",
      path: `/orderPostback/${orderId}`
    });
  }
  /** GET /order-ahead/v0/orderStatus/{orderId} — Get order status */
  async getStatus(orderId) {
    return this.http.request({
      path: `/order-ahead/v0/orderStatus/${orderId}`
    });
  }
  /** GET /authTest — Test authentication (returns text) */
  async testAuth() {
    return this.http.requestText({
      path: "/authTest"
    });
  }
  /** GET /health — Service health check (returns text) */
  async health() {
    return this.http.requestText({
      path: "/health"
    });
  }
};

// src/resources/orders.ts
var DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
function assertDateOnly(name, value) {
  if (value !== void 0 && !DATE_ONLY.test(value)) {
    throw new FlowhubValidationError(
      `${name} must be a YYYY-MM-DD date (Flowhub rejects full timestamps); received "${value}"`,
      { errors: [`${name}: expected YYYY-MM-DD`] }
    );
  }
}
function paginationQuery(params) {
  if (!params) return {};
  assertDateOnly("created_after", params.created_after);
  assertDateOnly("created_before", params.created_before);
  return {
    created_after: params.created_after,
    created_before: params.created_before,
    page: params.page,
    page_size: params.page_size,
    order_by: params.order_by
  };
}
var OrdersResource = class {
  constructor(http) {
    this.http = http;
  }
  http;
  // ── Customers ─────────────────────────────────────────────────
  /**
   * GET /v1/customers/ — Query customers.
   *
   * The spec declares a single customer-model response for this endpoint.
   * The actual API may return an array or paginated envelope — adjust the
   * return type once validated against a live response.
   */
  async getCustomers(params) {
    assertDateOnly("updated_after", params?.updated_after);
    assertDateOnly("updated_before", params?.updated_before);
    return this.http.request({
      path: "/v1/customers/",
      query: {
        ...paginationQuery(params),
        updated_after: params?.updated_after,
        updated_before: params?.updated_before
      }
    });
  }
  /** GET /v1/customers/{customerId} — Get a customer by ID */
  async getCustomerById(customerId, opts) {
    return this.http.request({
      path: `/v1/customers/${customerId}`,
      query: { store_id: opts?.store_id }
    });
  }
  /** GET /v1/customers/findByPhoneNumber — Get a customer by phone number */
  async getCustomerByPhone(phoneNumber) {
    return this.http.request({
      path: "/v1/customers/findByPhoneNumber",
      query: { phone_number: phoneNumber }
    });
  }
  /** POST /v1/customer?store_id={store_id} — Create a customer */
  async createCustomer(storeId, params) {
    return this.http.request({
      method: "POST",
      path: "/v1/customer",
      query: { store_id: storeId },
      body: params
    });
  }
  /** PUT /v1/customer/{customerId}?store_id={store_id} — Update a customer */
  async updateCustomer(customerId, storeId, params) {
    return this.http.request({
      method: "PUT",
      path: `/v1/customer/${customerId}`,
      query: { store_id: storeId },
      body: params
    });
  }
  // ── Orders (Sales) ────────────────────────────────────────────
  /** GET /v1/orders/findByCustomerId/{customerId} — List orders for a customer */
  async listByCustomerId(customerId, params) {
    return this.http.request({
      path: `/v1/orders/findByCustomerId/${customerId}`,
      query: paginationQuery(params)
    });
  }
  /** GET /v1/orders/findByLocationId/{importId} — List orders for a location */
  async listByLocationId(importId, params) {
    return this.http.request({
      path: `/v1/orders/findByLocationId/${importId}`,
      query: paginationQuery(params)
    });
  }
};

// src/client.ts
var FlowhubClient = class _FlowhubClient {
  locations;
  inventory;
  orders;
  orderAhead;
  authToken;
  /** The locationId this client is scoped to, if any. */
  locationId;
  http;
  options;
  constructor(options, locationId) {
    this.options = options;
    this.locationId = locationId;
    const credentials = {
      clientId: options.clientId,
      apiKey: options.apiKey,
      accessToken: options.accessToken
    };
    this.http = new HttpClient({
      credentials,
      baseUrl: options.baseUrl,
      timeout: options.timeout,
      retries: options.retries,
      fetchFn: options.fetchFn,
      maxDelayMs: options.maxDelayMs,
      jitter: options.jitter,
      rateLimit: options.rateLimit,
      onRateLimit: options.onRateLimit
    });
    this.locations = new LocationsResource(this.http);
    this.inventory = new InventoryResource(this.http, locationId);
    this.orders = new OrdersResource(this.http);
    this.orderAhead = new OrderAheadResource(this.http);
    this.authToken = new AuthTokenResource(options.fetchFn);
  }
  /**
   * Returns a new client scoped to a specific location.
   * The scoped client's inventory methods use /v0/locations/{locationId}/... endpoints.
   */
  forLocation(locationId) {
    return new _FlowhubClient(this.options, locationId);
  }
};
export {
  DEFAULT_BASE_URL,
  DOCS_SNAPSHOT_DATE,
  FlowhubAuthError,
  FlowhubClient,
  FlowhubError,
  FlowhubNotFoundError,
  FlowhubRateLimitError,
  FlowhubValidationError
};
//# sourceMappingURL=index.js.map