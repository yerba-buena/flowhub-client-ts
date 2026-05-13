// src/constants.ts
var DEFAULT_TIMEOUT_MS = 3e4;

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
  retryAfter;
  constructor(message, options) {
    super(message, { statusCode: 429, requestId: options?.requestId, cause: options?.cause });
    this.name = "FlowhubRateLimitError";
    this.retryAfter = options?.retryAfter;
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

// src/dashboard/http.ts
var DashboardHttp = class {
  baseUrl;
  timeout;
  fetchFn;
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeout = options.timeout;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }
  async graphql(request, token) {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json"
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await this.fetchWithTimeout(`${this.baseUrl}/graph/query`, {
      method: "POST",
      headers,
      body: JSON.stringify(request)
    });
    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw this.mapError(response.status, body);
    }
    const parsed = await response.json();
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
  async downloadBinary(path, query, token) {
    const url = this.buildUrl(path, query);
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: "application/octet-stream",
        Authorization: `Bearer ${token}`
      }
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
      contentType
    };
  }
  async fetchWithTimeout(url, init) {
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
  buildUrl(path, query) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const url = new URL(`${this.baseUrl}${normalizedPath}`);
    for (const [k, v] of Object.entries(query)) {
      if (v !== void 0) {
        url.searchParams.set(k, String(v));
      }
    }
    return url.toString();
  }
  parseContentDisposition(header) {
    if (!header) return void 0;
    const match = header.match(/filename\*?=(?:UTF-8'')?["']?([^"';]+)/i);
    return match?.[1] ? decodeURIComponent(match[1]) : void 0;
  }
  mapError(status, body) {
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
          statusCode: status
        });
    }
  }
};

// src/dashboard/reports.ts
var ReportsResource = class {
  constructor(http, auth, defaultStoreId) {
    this.http = http;
    this.auth = auth;
    this.defaultStoreId = defaultStoreId;
  }
  http;
  auth;
  defaultStoreId;
  /**
   * Download an arbitrary report by its ID.
   *
   * Use this for any of the ~60 report IDs Flowhub exposes (e.g. "accounting",
   * "category-sales", "inventory-snapshot"). Custom report UUIDs work too.
   */
  async downloadReport(reportId, params = {}) {
    const merged = { ...params };
    if (this.defaultStoreId && merged.store_id === void 0) {
      merged.store_id = this.defaultStoreId;
    }
    const path = `/analytics/${reportId}`;
    const downloadOnce = async () => {
      const token = await this.auth.getToken();
      return this.http.downloadBinary(path, merged, token);
    };
    let result;
    try {
      result = await downloadOnce();
    } catch (err) {
      if (err instanceof FlowhubAuthError) {
        this.auth.invalidate();
        result = await downloadOnce();
      } else {
        throw err;
      }
    }
    return {
      data: result.data,
      filename: result.filename ?? this.fallbackFilename(reportId, merged),
      contentType: result.contentType
    };
  }
  /** Convenience: Accounting report (taxes, discounts, refunds, totals). */
  async downloadAccounting(params) {
    return this.downloadReport("accounting", params);
  }
  /** Convenience: Sales by day by store. */
  async downloadSalesByDayStore(params) {
    return this.downloadReport("sales-day-store", params);
  }
  /** Convenience: Category sales summary. */
  async downloadCategorySales(params) {
    return this.downloadReport("category-sales", params);
  }
  /** Convenience: End-of-day report. */
  async downloadEndOfDay(params) {
    return this.downloadReport("end-of-day", params);
  }
  /** Convenience: Transactions report. */
  async downloadTransactions(params) {
    return this.downloadReport("transactions", params);
  }
  /** Convenience: Inventory snapshot (no date range required). */
  async downloadInventorySnapshot(params = {}) {
    return this.downloadReport("inventory-snapshot", params);
  }
  /** Convenience: Inventory levels. */
  async downloadInventoryLevels(params = {}) {
    return this.downloadReport("inventory-levels", params);
  }
  fallbackFilename(reportId, params) {
    const parts = [reportId];
    if (typeof params.start_date === "string") parts.push(String(params.start_date));
    if (typeof params.end_date === "string" && params.end_date !== params.start_date) {
      parts.push(String(params.end_date));
    }
    return `${parts.join("-")}.csv`;
  }
};

// src/dashboard/session-auth.ts
var REFRESH_MARGIN_SECONDS = 5 * 60;
var LOGIN_QUERY = `
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    id
    refreshId
    expireTime
  }
}
`;
var SessionAuth = class {
  credentials;
  http;
  cached;
  pendingLogin;
  constructor(credentials, http) {
    this.credentials = credentials;
    this.http = http;
  }
  async getToken() {
    if (this.cached && !this.isExpiringSoon(this.cached)) {
      return this.cached.id;
    }
    if (this.pendingLogin) {
      const result = await this.pendingLogin;
      return result.id;
    }
    this.pendingLogin = this.login();
    try {
      const result = await this.pendingLogin;
      this.cached = result;
      return result.id;
    } finally {
      this.pendingLogin = void 0;
    }
  }
  invalidate() {
    this.cached = void 0;
  }
  async login() {
    try {
      const data = await this.http.graphql({
        operationName: "Login",
        variables: {
          email: this.credentials.email,
          password: this.credentials.password
        },
        query: LOGIN_QUERY
      });
      if (!data.login || !data.login.id) {
        throw new FlowhubAuthError("Login response missing token");
      }
      return {
        id: data.login.id,
        refreshId: data.login.refreshId,
        expireTime: data.login.expireTime
      };
    } catch (err) {
      if (err instanceof FlowhubAuthError) throw err;
      throw new FlowhubAuthError("Dashboard login failed", { cause: err });
    }
  }
  isExpiringSoon(token) {
    const nowSeconds = Math.floor(Date.now() / 1e3);
    return token.expireTime - nowSeconds <= REFRESH_MARGIN_SECONDS;
  }
};

// src/dashboard/client.ts
var DEFAULT_DASHBOARD_BASE_URL = "https://api.flowhub.com";
var FlowhubDashboardClient = class _FlowhubDashboardClient {
  reports;
  storeId;
  config;
  constructor(config) {
    if (!config.email || config.email.trim() === "") {
      throw new FlowhubError("FlowhubDashboardClient: email is required");
    }
    if (!config.password || config.password === "") {
      throw new FlowhubError("FlowhubDashboardClient: password is required");
    }
    this.config = config;
    this.storeId = config.storeId;
    const http = new DashboardHttp({
      baseUrl: config.baseUrl ?? DEFAULT_DASHBOARD_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT_MS
    });
    const auth = new SessionAuth(
      { email: config.email, password: config.password },
      http
    );
    this.reports = new ReportsResource(http, auth, config.storeId);
  }
  /** Returns a new client scoped to the given storeId for default report params. */
  forStore(storeId) {
    return new _FlowhubDashboardClient({ ...this.config, storeId });
  }
};
export {
  DEFAULT_DASHBOARD_BASE_URL,
  FlowhubAuthError,
  FlowhubDashboardClient,
  FlowhubError,
  FlowhubNotFoundError,
  FlowhubRateLimitError,
  FlowhubValidationError
};
//# sourceMappingURL=index.js.map