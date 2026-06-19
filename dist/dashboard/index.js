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

// src/internal/cash-management.ts
var RECEIPT_KINDS_WITH_EVENT = /* @__PURE__ */ new Set(["drop", "pop", "payin", "payout"]);
var DRAWER_FIELDS = `
fragment DrawerFields on Drawer {
  id
  name
  type
  openedAt
  closedAt
  dropTriggerBalance
  needsDrop
  rooms { id name }
  users { id email meta { firstName lastName } }
  counts {
    id
    drawerId
    openedAt
    openedByUser { id email meta { firstName lastName } }
    ClosedAt
    closedByUser { id email meta { firstName lastName } }
    openingCashBalance
    cashBalance
    closingCashBalance
    openingCounts {
      total
      notes
      denominations {
        pennies nickels dimes quarters
        ones twos fives tens twenties fifties hundreds
      }
    }
    closingCounts {
      total
      notes
      denominations {
        pennies nickels dimes quarters
        ones twos fives tens twenties fifties hundreds
      }
    }
    cashRevenue
    debitRevenue
    achRevenue
    giftCardRevenue
    debitBalance
    achBalance
    debitTipRevenue
    closingDebitBalance
    closingRevenue
    payins  { id total reason timestamp user_id balance_before balance_after }
    payouts { id total reason timestamp user_id balance_before balance_after }
    drops   { id total reason timestamp user_id balance_before balance_after }
    pops    { id total reason timestamp user_id balance_before balance_after }
    totalPaidIn
    totalPaidOut
    totalDropped
    totalRevenueSinceOpen
  }
}
`;
var GET_DRAWERS_QUERY = `
${DRAWER_FIELDS}
query GetDrawers($id: String, $hidden: Boolean, $orderBy: String, $orderDirection: String) {
  drawers(id: $id, hidden: $hidden, orderBy: $orderBy, orderDirection: $orderDirection) {
    ...DrawerFields
  }
}
`;
var GET_DRAWER_ACTIVITIES_QUERY = `
${DRAWER_FIELDS}
query GetDrawerActivities($id: String!, $startDate: String!, $endDate: String!) {
  drawerActivities(id: $id, startDate: $startDate, endDate: $endDate) {
    actionTimestamp
    action
    subaction
    employeeName
    snapshot { ...DrawerFields }
    changedValues {
      name        { to from }
      type        { to from }
      dropTriggerBalance { to from }
      rooms       { to { id name } from { id name } }
      users       { to { id email meta { firstName lastName } } from { id email meta { firstName lastName } } }
    }
  }
}
`;
var GET_DRAWER_TIPS_QUERY = `
query GetDrawerTips($drawerCountId: String!) {
  drawerTips(drawerCountId: $drawerCountId) {
    name
    amount
  }
}
`;
var CREATE_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation CreateDrawer(
  $name: String!
  $type: String!
  $rooms: [String!]!
  $dropTriggerBalance: Int!
) {
  createDrawer(
    name: $name
    type: $type
    rooms: $rooms
    dropTriggerBalance: $dropTriggerBalance
  ) {
    ...DrawerFields
  }
}
`;
var UPDATE_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation UpdateDrawer(
  $id: String!
  $name: String!
  $type: String!
  $rooms: [String!]!
  $dropTriggerBalance: Int!
) {
  updateDrawer(
    id: $id
    name: $name
    type: $type
    rooms: $rooms
    dropTriggerBalance: $dropTriggerBalance
  ) {
    ...DrawerFields
  }
}
`;
var DELETE_DRAWER_MUTATION = `
mutation DeleteDrawer($id: String!) {
  deleteDrawer(id: $id)
}
`;
var ADD_DRAWER_USER_MUTATION = `
${DRAWER_FIELDS}
mutation AddDrawerUser($drawerId: String!, $userId: String!) {
  addDrawerUser(drawerId: $drawerId, userId: $userId) {
    ...DrawerFields
  }
}
`;
var REMOVE_DRAWER_USER_MUTATION = `
${DRAWER_FIELDS}
mutation RemoveDrawerUser($drawerId: String!, $userId: String!) {
  removeDrawerUser(drawerId: $drawerId, userId: $userId) {
    ...DrawerFields
  }
}
`;
var OPEN_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation OpenDrawer($id: String!, $count: CountRecordInput!) {
  openDrawer(id: $id, count: $count) {
    ...DrawerFields
  }
}
`;
var CLOSE_DRAWER_MUTATION = `
${DRAWER_FIELDS}
mutation CloseDrawer($id: String!, $count: CountRecordInput!) {
  closeDrawer(id: $id, count: $count) {
    ...DrawerFields
  }
}
`;
var MAKE_DROP_MUTATION = `
${DRAWER_FIELDS}
mutation MakeDrop($drawerId: String!, $drop: CashEventInput!) {
  makeDrop(drawerId: $drawerId, drop: $drop) {
    ...DrawerFields
  }
}
`;
var MAKE_POP_MUTATION = `
${DRAWER_FIELDS}
mutation MakePop($drawerId: String!, $pop: CashEventInput!) {
  makePop(drawerId: $drawerId, pop: $pop) {
    ...DrawerFields
  }
}
`;
var MAKE_PAYIN_MUTATION = `
${DRAWER_FIELDS}
mutation MakePayin($drawerId: String!, $payin: CashEventInput!) {
  makePayin(drawerId: $drawerId, payin: $payin) {
    ...DrawerFields
  }
}
`;
var MAKE_PAYOUT_MUTATION = `
${DRAWER_FIELDS}
mutation MakePayout($drawerId: String!, $payout: CashEventInput!) {
  makePayout(drawerId: $drawerId, payout: $payout) {
    ...DrawerFields
  }
}
`;
var DrawersResource = class {
  constructor(http, auth) {
    this.http = http;
    this.auth = auth;
  }
  http;
  auth;
  /**
   * List drawers. With no params, returns all drawers. Pass `hidden: false`
   * to exclude soft-deleted drawers (matches what the dashboard's drawers
   * page polls every ~5 seconds).
   */
  async list(params = {}) {
    const variables = {};
    if (params.hidden !== void 0) variables.hidden = params.hidden;
    if (params.orderBy !== void 0) variables.orderBy = params.orderBy;
    if (params.orderDirection !== void 0) variables.orderDirection = params.orderDirection;
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "GetDrawers",
          variables,
          query: GET_DRAWERS_QUERY
        },
        token
      )
    );
    return data.drawers;
  }
  /**
   * Fetch a single drawer by ID. Returns `null` if the server returns an
   * empty list (the drawer doesn't exist or is hidden).
   */
  async get(id) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "GetDrawers",
          variables: { id },
          query: GET_DRAWERS_QUERY
        },
        token
      )
    );
    return data.drawers[0] ?? null;
  }
  /**
   * Audit feed for a single drawer over a date range. Includes create /
   * update / open / close / drop / pop / payin / payout events with the
   * full drawer snapshot at each point.
   */
  async listActivity(drawerId, params) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "GetDrawerActivities",
          variables: {
            id: drawerId,
            startDate: params.startDate,
            endDate: params.endDate
          },
          query: GET_DRAWER_ACTIVITIES_QUERY
        },
        token
      )
    );
    return data.drawerActivities;
  }
  /**
   * Tip totals associated with a particular drawer count (between an open
   * and a close). Keyed by `drawerCountId`, NOT the drawer's own ID.
   */
  async listTips(drawerCountId) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "GetDrawerTips",
          variables: { drawerCountId },
          query: GET_DRAWER_TIPS_QUERY
        },
        token
      )
    );
    return data.drawerTips;
  }
  /**
   * Create a new drawer. `rooms` is a list of room UUIDs the drawer is
   * scoped to; `dropTriggerBalance` is in integer cents. Returned drawer
   * has `openedAt: null` and `counts: null` until `open()` is called.
   */
  async create(input) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "CreateDrawer",
          variables: {
            name: input.name,
            type: input.type,
            rooms: input.rooms,
            dropTriggerBalance: input.dropTriggerBalance
          },
          query: CREATE_DRAWER_MUTATION
        },
        token
      )
    );
    return data.createDrawer;
  }
  /**
   * Update an existing drawer. Fires even on no-op edits — the server
   * tolerates that. Note: this does NOT manage user assignment; use
   * `assignUser` / `unassignUser` for that.
   */
  async update(id, input) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "UpdateDrawer",
          variables: {
            id,
            name: input.name,
            type: input.type,
            rooms: input.rooms,
            dropTriggerBalance: input.dropTriggerBalance
          },
          query: UPDATE_DRAWER_MUTATION
        },
        token
      )
    );
    return data.updateDrawer;
  }
  /**
   * Delete a drawer. The server returns an empty array on success; this
   * method normalises that to `void`. The drawer is soft-deleted (hidden)
   * rather than physically removed.
   */
  async delete(id) {
    await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "DeleteDrawer",
          variables: { id },
          query: DELETE_DRAWER_MUTATION
        },
        token
      )
    );
  }
  /**
   * Assign a user to a drawer. Drawer↔user is many-to-many; calling this
   * with an already-assigned user is a no-op on the server side.
   */
  async assignUser(drawerId, userId) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "AddDrawerUser",
          variables: { drawerId, userId },
          query: ADD_DRAWER_USER_MUTATION
        },
        token
      )
    );
    return data.addDrawerUser;
  }
  /** Remove a user from a drawer. */
  async unassignUser(drawerId, userId) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "RemoveDrawerUser",
          variables: { drawerId, userId },
          query: REMOVE_DRAWER_USER_MUTATION
        },
        token
      )
    );
    return data.removeDrawerUser;
  }
  /**
   * Open a drawer with an opening count (cash on hand at the start of the
   * shift). Sets `counts.openedAt`, `counts.openedByUser`, and
   * `counts.openingCounts`. The drawer must currently be closed (or
   * not-yet-opened) — opening an already-open drawer is rejected
   * server-side.
   */
  async open(id, count) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "OpenDrawer",
          variables: { id, count },
          query: OPEN_DRAWER_MUTATION
        },
        token
      )
    );
    return data.openDrawer;
  }
  /**
   * Close a drawer with a closing count. Sets `counts.ClosedAt`
   * (server-side capitalisation preserved), `counts.closedByUser`, and
   * `counts.closingCounts`. The drawer must currently be open.
   */
  async close(id, count) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "CloseDrawer",
          variables: { id, count },
          query: CLOSE_DRAWER_MUTATION
        },
        token
      )
    );
    return data.closeDrawer;
  }
  /**
   * Pay-in: cash added to the drawer from outside normal sales (e.g.
   * replenishing change from another register). Effect: `cashBalance +=
   * total`, `cashRevenue` unchanged. Appends to `counts.payins[]`.
   */
  async payIn(drawerId, params) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "MakePayin",
          variables: { drawerId, payin: params },
          query: MAKE_PAYIN_MUTATION
        },
        token
      )
    );
    return data.makePayin;
  }
  /**
   * Pay-out: cash removed from the drawer to pay something/someone that
   * isn't a deposit (vendor, tip-out, supplies). Effect: `cashBalance -=
   * total`, `cashRevenue -= total` (recorded as negative revenue).
   * Appends to `counts.payouts[]`.
   */
  async payOut(drawerId, params) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "MakePayout",
          variables: { drawerId, payout: params },
          query: MAKE_PAYOUT_MUTATION
        },
        token
      )
    );
    return data.makePayout;
  }
  /**
   * Drop: cash removed from the drawer for deposit (to safe / bank).
   * Effect: `cashBalance -= total`, `cashRevenue` unchanged. Appends to
   * `counts.drops[]`. Triggered manually or in response to `needsDrop`
   * flipping true when `cashBalance` exceeds `dropTriggerBalance`.
   */
  async drop(drawerId, params) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "MakeDrop",
          variables: { drawerId, drop: params },
          query: MAKE_DROP_MUTATION
        },
        token
      )
    );
    return data.makeDrop;
  }
  /**
   * Pop: open the drawer with no cash change — equivalent to a "No Sale"
   * button on a traditional register. Audit-trail only. `total` is
   * usually 0. Appends to `counts.pops[]`.
   */
  async pop(drawerId, params) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "MakePop",
          variables: { drawerId, pop: params },
          query: MAKE_POP_MUTATION
        },
        token
      )
    );
    return data.makePop;
  }
  /**
   * Build the absolute URL for a receipt PDF without making a network
   * call. Useful for embedding receipt links in a UI, or for printing
   * via the user's browser instead of going through the SDK.
   *
   * `drawerCountId` is `counts.id` (not the drawer's own ID).
   * `eventId` is the UUID of the drop / pop / payin / payout — required
   * for those four kinds, omitted for open / close.
   */
  buildReceiptUrl(opts) {
    const { drawerCountId, kind, eventId } = opts;
    if (RECEIPT_KINDS_WITH_EVENT.has(kind)) {
      if (!eventId) {
        throw new FlowhubValidationError(`buildReceiptUrl: ${kind} receipts require an eventId`, {
          errors: [`Missing eventId for receipt kind "${kind}"`]
        });
      }
      return `${this.http.baseUrl}/printing/drawer/${drawerCountId}/${kind}/${eventId}`;
    }
    if (eventId !== void 0) {
      throw new FlowhubValidationError(
        `buildReceiptUrl: ${kind} receipts must NOT include an eventId`,
        { errors: [`Unexpected eventId for receipt kind "${kind}"`] }
      );
    }
    return `${this.http.baseUrl}/printing/drawer/${drawerCountId}/${kind}`;
  }
  /**
   * Download a receipt PDF for an open / close / drop / pop / payin /
   * payout event. Returns the bytes and the response headers (filename,
   * content type). Retries once on 401 just like the other methods.
   */
  async downloadReceipt(opts) {
    const url = this.buildReceiptUrl(opts);
    const path = url.slice(this.http.baseUrl.length);
    const result = await this.withAuthRetry(
      (token) => this.http.downloadBinary(path, {}, token, { accept: "application/pdf" })
    );
    return {
      data: result.data,
      contentType: result.contentType,
      filename: result.filename
    };
  }
  async withAuthRetry(fn) {
    const tryOnce = async () => {
      const token = await this.auth.getToken();
      return fn(token);
    };
    try {
      return await tryOnce();
    } catch (err) {
      if (err instanceof FlowhubAuthError) {
        this.auth.invalidate();
        return tryOnce();
      }
      throw err;
    }
  }
};

// src/internal/employees.ts
var FILTERED_USERS_FIELDS = `
    id
    email
    phoneNumber
    status
    isInternal
    activeStoreId
    meta
    roleId
    role { id name }
    stores { id name }
`;
var GET_ALL_USERS_QUERY = `
query GetAllUsers(
  $storeId: ID
  $search: String
  $status: UserStatus
  $roleId: ID
  $limit: Int
  $offset: Int
  $orderBy: UsersOrderBy
  $orderDirection: OrderDirection
) {
  users: filteredUsers(
    usersParams: {
      storeId: $storeId
      search: $search
      status: $status
      roleId: $roleId
      limit: $limit
      offset: $offset
      orderBy: $orderBy
      orderDirection: $orderDirection
    }
  ) {
${FILTERED_USERS_FIELDS}
  }
}
`;
var GET_ONE_USER_QUERY = `
query GetOneUser($id: ID) {
  users: filteredUsers(usersParams: { userId: $id, status: all }) {
${FILTERED_USERS_FIELDS}
  }
}
`;
var LIST_ALL_PAGE_SIZE = 100;
function toEmployee(u) {
  const firstName = u.meta?.firstName ?? null;
  const lastName = u.meta?.lastName ?? null;
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  const stores = u.stores ?? [];
  return {
    id: u.id,
    name,
    firstName,
    lastName,
    email: u.email,
    phoneNumber: u.phoneNumber ?? null,
    status: u.status,
    active: u.status === "active",
    isInternal: u.isInternal,
    activeStoreId: u.activeStoreId ?? null,
    role: u.role ?? null,
    storeIds: stores.map((s) => s.id),
    stores
  };
}
var EmployeesResource = class {
  constructor(http, auth, defaultStoreId) {
    this.http = http;
    this.auth = auth;
    this.defaultStoreId = defaultStoreId;
  }
  http;
  auth;
  defaultStoreId;
  /**
   * List one page of employees. Defaults to `status: "active"` and applies the
   * client's default `storeId` when one isn't passed. Pass `limit`/`offset` to
   * paginate, or use {@link listAll} to fetch the entire roster.
   */
  async list(params = {}) {
    const variables = {
      storeId: params.storeId ?? this.defaultStoreId,
      search: params.search ?? null,
      status: params.status ?? "active",
      roleId: params.roleId,
      limit: params.limit,
      offset: params.offset,
      orderBy: params.orderBy,
      orderDirection: params.orderDirection
    };
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        { operationName: "GetAllUsers", variables, query: GET_ALL_USERS_QUERY },
        token
      )
    );
    return data.users.map(toEmployee);
  }
  /**
   * Fetch the entire roster by auto-paginating `list()`. Useful for building an
   * `email → employee` index in one call. `limit`/`offset` in `params` are
   * ignored (pagination is managed internally).
   */
  async listAll(params = {}) {
    const all = [];
    let offset = 0;
    for (; ; ) {
      const page = await this.list({ ...params, limit: LIST_ALL_PAGE_SIZE, offset });
      all.push(...page);
      if (page.length < LIST_ALL_PAGE_SIZE) break;
      offset += LIST_ALL_PAGE_SIZE;
    }
    return all;
  }
  /** Fetch a single employee by their user UUID, or `null` if not found. */
  async get(id) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        { operationName: "GetOneUser", variables: { id }, query: GET_ONE_USER_QUERY },
        token
      )
    );
    const user = data.users[0];
    return user ? toEmployee(user) : null;
  }
  async withAuthRetry(fn) {
    const tryOnce = async () => {
      const token = await this.auth.getToken();
      return fn(token);
    };
    try {
      return await tryOnce();
    } catch (err) {
      if (err instanceof FlowhubAuthError) {
        this.auth.invalidate();
        return tryOnce();
      }
      throw err;
    }
  }
};

// src/internal/http.ts
var InternalHttp = class {
  /** Normalised base URL (trailing slashes stripped). Exposed so resources can build receipt-style URLs. */
  baseUrl;
  timeout;
  fetchFn;
  constructor(options) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "");
    this.timeout = options.timeout;
    this.fetchFn = options.fetchFn ?? globalThis.fetch;
  }
  async graphql(request, token, path = "/graph/query") {
    const headers = {
      "Content-Type": "application/json",
      Accept: "application/json",
      Origin: "https://app.flowhub.com"
    };
    if (token) headers.Authorization = token;
    const response = await this.fetchWithTimeout(`${this.baseUrl}${path}`, {
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
  async downloadBinary(path, query, token, options = {}) {
    const url = this.buildUrl(path, query);
    const response = await this.fetchWithTimeout(url, {
      method: "GET",
      headers: {
        Accept: options.accept ?? "application/octet-stream",
        Authorization: token,
        Origin: "https://app.flowhub.com"
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

// src/internal/csv.ts
function parseCsvRaw(text) {
  const records = [];
  let field = "";
  let record = [];
  let inQuotes = false;
  let started = false;
  const pushField = () => {
    record.push(field);
    field = "";
  };
  const pushRecord = () => {
    pushField();
    records.push(record);
    record = [];
    started = false;
  };
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }
    if (c === '"') {
      inQuotes = true;
      started = true;
    } else if (c === ",") {
      pushField();
      started = true;
    } else if (c === "\n") {
      pushRecord();
    } else if (c === "\r") {
      if (text[i + 1] !== "\n") pushRecord();
    } else {
      field += c;
      started = true;
    }
  }
  if (started || field !== "" || record.length > 0) pushRecord();
  const columns = records.shift() ?? [];
  return { columns, rows: records };
}
function parseCsv(text) {
  const { columns, rows } = parseCsvRaw(text);
  const objects = rows.map((cells) => {
    const obj = {};
    for (let i = 0; i < columns.length; i++) {
      obj[columns[i]] = cells[i] ?? "";
    }
    return obj;
  });
  return { columns, rows: objects };
}

// src/internal/reports.ts
var GET_REPORTS_QUERY = `
query GetReports {
  reports {
    reportId
    name
    description
    isCustom
    isFavorite
    reportTypeInfo {
      type
    }
    parameters {
      key
      type
      name
      description
      isHidden
      isRequired
      defaultValue
      options {
        option
        value
      }
    }
  }
}
`;
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
   * List all reports available to the authenticated user, including custom
   * and shared reports specific to their account. The returned `reportId`
   * values can be passed to `downloadReport()`.
   */
  async listReports() {
    const token = await this.auth.getToken();
    const data = await this.http.graphql(
      {
        operationName: "GetReports",
        variables: {},
        query: GET_REPORTS_QUERY
      },
      token,
      "/analytics/query"
    );
    return data.reports.map((r) => ({
      reportId: r.reportId,
      name: r.name,
      description: r.description,
      type: r.reportTypeInfo.type,
      isCustom: r.isCustom,
      isFavorite: r.isFavorite,
      parameters: r.parameters.map((p) => ({
        key: p.key,
        type: p.type,
        name: p.name,
        description: p.description,
        isRequired: p.isRequired,
        isHidden: p.isHidden,
        defaultValue: p.defaultValue,
        options: p.options
      }))
    }));
  }
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
  /**
   * Download a report and parse its CSV into header + row objects.
   *
   * Works for any report ID. Each row is an object keyed by the CSV column
   * headers, with raw string values (no type coercion). Use this when you want
   * to consume report data programmatically instead of handling raw bytes.
   */
  async downloadReportRows(reportId, params = {}) {
    const { data, filename } = await this.downloadReport(reportId, params);
    const { columns, rows } = parseCsv(data.toString("utf-8"));
    return { columns, rows, filename };
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
  /**
   * Convenience: Inventory activity — the per-SKU movement / audit log
   * (sales, imports, adjustments, transfers) with quantity deltas and the
   * employee responsible. This is the report behind the dashboard's
   * Inventory → "Log" tab. Filter to a single SKU client-side, or narrow the
   * date range. Read-only / after-the-fact; not a live feed.
   */
  async downloadInventoryActivity(params) {
    return this.downloadReport("inventory-activity", params);
  }
  /**
   * Convenience: Product activity — history of changes to product-catalog
   * records over a date range. Complements `downloadInventoryActivity` (which
   * tracks physical stock movement) by tracking catalog-level edits.
   */
  async downloadProductActivity(params) {
    return this.downloadReport("product-activity", params);
  }
  /** Convenience: Deals usage — redemptions/usage of deals over a date range. */
  async downloadDealsUsage(params) {
    return this.downloadReport("deals-usage", params);
  }
  /**
   * Convenience: Deals full details — the configured deals catalog with their
   * full configuration. Read-only; there is no public or (yet) reverse-engineered
   * write path for creating/editing deals.
   */
  async downloadDealsFullDetails(params) {
    return this.downloadReport("deals-full-details", params);
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

// src/internal/rooms.ts
var GET_ROOMS_QUERY = `
query GetRooms {
  rooms {
    id
    name
    isForSale
  }
}
`;
var RoomsResource = class {
  constructor(http, auth) {
    this.http = http;
    this.auth = auth;
  }
  http;
  auth;
  async list() {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "GetRooms",
          variables: {},
          query: GET_ROOMS_QUERY
        },
        token
      )
    );
    return data.rooms;
  }
  async withAuthRetry(fn) {
    const tryOnce = async () => {
      const token = await this.auth.getToken();
      return fn(token);
    };
    try {
      return await tryOnce();
    } catch (err) {
      if (err instanceof FlowhubAuthError) {
        this.auth.invalidate();
        return tryOnce();
      }
      throw err;
    }
  }
};

// src/internal/sales.ts
var SALE_FIELDS = `
    id
    source
    receiptId
    storeId
    storeName
    purchaseType
    completedAt
    editedCount
    soldBy { id meta }
    drawer { id name }
    totalPreTaxPrice
    totalPostTaxPrice
    totalItemPrice
    totalDiscounts
    totalTaxes
    totalFees
    totalPrice
    loyalty { pointsEarned pointsSpent }
    items {
      id
      inventoryId
      categoryId
      brand
      productName
      variantName
      sku
      regulatoryId
      isSoldByWeight
      quantity
      preTaxPrice
      postTaxPrice
      totalItemCost
      totalPrice
      totalDiscounts
      totalTaxes
    }
`;
var GET_SALES_QUERY = `
query GetSales(
  $startDate: Date
  $endDate: Date
  $limit: Int
  $offset: Int
  $id: Uuid
  $receiptId: ID
  $drawerIds: [ID]
  $employeeIds: [ID]
  $reportingStatus: SalesReportingStatus
  $customerType: SalesCustomerType
  $paymentMethod: PaymentMethod
  $source: String
  $orderBy: SalesOrderBy
  $orderDirection: OrderDirection
  $shouldIncludeAllStores: Boolean
  $search: String
) {
  sales: filteredSales(
    salesParams: {
      startDate: $startDate
      endDate: $endDate
      limit: $limit
      offset: $offset
      id: $id
      receiptId: $receiptId
      drawerIds: $drawerIds
      employeeIds: $employeeIds
      reportingStatus: $reportingStatus
      customerType: $customerType
      paymentMethod: $paymentMethod
      source: $source
      orderBy: $orderBy
      orderDirection: $orderDirection
      shouldIncludeAllStores: $shouldIncludeAllStores
      search: $search
    }
  ) {
${SALE_FIELDS}
  }
}
`;
var LIST_ALL_PAGE_SIZE2 = 100;
function toSale(s) {
  const firstName = s.soldBy?.meta?.firstName ?? null;
  const lastName = s.soldBy?.meta?.lastName ?? null;
  const soldBy = s.soldBy ? {
    id: s.soldBy.id,
    firstName,
    lastName,
    name: [firstName, lastName].filter(Boolean).join(" ").trim()
  } : null;
  const items = s.items ?? [];
  return {
    id: s.id,
    source: s.source ?? null,
    receiptId: s.receiptId ?? null,
    storeId: s.storeId,
    storeName: s.storeName ?? null,
    purchaseType: s.purchaseType,
    completedAt: s.completedAt,
    editedCount: s.editedCount ?? null,
    soldBy,
    drawer: s.drawer ?? null,
    totalPreTaxPrice: s.totalPreTaxPrice,
    totalPostTaxPrice: s.totalPostTaxPrice,
    totalItemPrice: s.totalItemPrice,
    totalDiscounts: s.totalDiscounts,
    totalTaxes: s.totalTaxes,
    totalFees: s.totalFees,
    totalPrice: s.totalPrice,
    loyalty: s.loyalty ?? null,
    items,
    itemCount: items.reduce((sum, it) => sum + (it.quantity ?? 0), 0)
  };
}
var SalesResource = class {
  constructor(http, auth) {
    this.http = http;
    this.auth = auth;
  }
  http;
  auth;
  /** List one page of sales within a date range. `startDate`/`endDate` required. */
  async list(params) {
    const variables = {
      startDate: params.startDate,
      endDate: params.endDate,
      limit: params.limit,
      offset: params.offset,
      employeeIds: params.employeeIds,
      drawerIds: params.drawerIds,
      reportingStatus: params.reportingStatus ?? "all",
      customerType: params.customerType,
      paymentMethod: params.paymentMethod,
      source: params.source,
      orderBy: params.orderBy ?? "completedAt",
      orderDirection: params.orderDirection ?? "desc",
      shouldIncludeAllStores: params.shouldIncludeAllStores ?? false,
      search: params.search ?? null
    };
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        { operationName: "GetSales", variables, query: GET_SALES_QUERY },
        token
      )
    );
    return data.sales.map(toSale);
  }
  /**
   * Fetch every sale in the range by auto-paginating `list()`. `limit`/`offset`
   * in `params` are ignored (managed internally).
   */
  async listAll(params) {
    const all = [];
    let offset = 0;
    for (; ; ) {
      const page = await this.list({ ...params, limit: LIST_ALL_PAGE_SIZE2, offset });
      all.push(...page);
      if (page.length < LIST_ALL_PAGE_SIZE2) break;
      offset += LIST_ALL_PAGE_SIZE2;
    }
    return all;
  }
  /** Fetch a single sale by its UUID, or `null` if not found. */
  async get(id) {
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        { operationName: "GetSales", variables: { id }, query: GET_SALES_QUERY },
        token
      )
    );
    const sale = data.sales[0];
    return sale ? toSale(sale) : null;
  }
  async withAuthRetry(fn) {
    const tryOnce = async () => {
      const token = await this.auth.getToken();
      return fn(token);
    };
    try {
      return await tryOnce();
    } catch (err) {
      if (err instanceof FlowhubAuthError) {
        this.auth.invalidate();
        return tryOnce();
      }
      throw err;
    }
  }
};

// src/internal/session-auth.ts
var REFRESH_MARGIN_SECONDS = 5 * 60;
var LOGIN_QUERY = `
query Login($email: String!, $password: String!) {
  login(login: { email: $email, password: $password }) {
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

// src/internal/users.ts
var GET_USERS_QUERY = `
query GetUsers(
  $storeUsers: Boolean
  $storeId: String
  $storeIds: [String!]
  $status: String
  $orderBy: String
  $isInternal: Boolean
) {
  users(
    storeUsers: $storeUsers
    storeId: $storeId
    storeIds: $storeIds
    status: $status
    orderBy: $orderBy
    isInternal: $isInternal
  ) {
    id
    email
    meta { firstName lastName }
    phoneNumber
    stores { id name }
    role { id name permissions }
  }
}
`;
var UsersResource = class {
  constructor(http, auth) {
    this.http = http;
    this.auth = auth;
  }
  http;
  auth;
  /**
   * List users. Pass `storeUsers: true` to scope to users assigned to a
   * store (the most common case when populating a "who performed this
   * action" dropdown).
   */
  async list(params = {}) {
    const variables = {};
    if (params.storeUsers !== void 0) variables.storeUsers = params.storeUsers;
    if (params.storeId !== void 0) variables.storeId = params.storeId;
    if (params.storeIds !== void 0) variables.storeIds = params.storeIds;
    if (params.status !== void 0) variables.status = params.status;
    if (params.orderBy !== void 0) variables.orderBy = params.orderBy;
    if (params.isInternal !== void 0) variables.isInternal = params.isInternal;
    const data = await this.withAuthRetry(
      (token) => this.http.graphql(
        {
          operationName: "GetUsers",
          variables,
          query: GET_USERS_QUERY
        },
        token
      )
    );
    return data.users;
  }
  async withAuthRetry(fn) {
    const tryOnce = async () => {
      const token = await this.auth.getToken();
      return fn(token);
    };
    try {
      return await tryOnce();
    } catch (err) {
      if (err instanceof FlowhubAuthError) {
        this.auth.invalidate();
        return tryOnce();
      }
      throw err;
    }
  }
};

// src/internal/client.ts
var DEFAULT_INTERNAL_BASE_URL = "https://api.flowhub.com";
var FlowhubInternalClient = class _FlowhubInternalClient {
  reports;
  drawers;
  users;
  employees;
  sales;
  rooms;
  storeId;
  config;
  constructor(config) {
    if (!config.email || config.email.trim() === "") {
      throw new FlowhubError("FlowhubInternalClient: email is required");
    }
    if (!config.password || config.password === "") {
      throw new FlowhubError("FlowhubInternalClient: password is required");
    }
    this.config = config;
    this.storeId = config.storeId;
    const http = new InternalHttp({
      baseUrl: config.baseUrl ?? DEFAULT_INTERNAL_BASE_URL,
      timeout: config.timeout ?? DEFAULT_TIMEOUT_MS,
      fetchFn: config.fetchFn
    });
    const auth = new SessionAuth({ email: config.email, password: config.password }, http);
    this.reports = new ReportsResource(http, auth, config.storeId);
    this.drawers = new DrawersResource(http, auth);
    this.users = new UsersResource(http, auth);
    this.employees = new EmployeesResource(http, auth, config.storeId);
    this.sales = new SalesResource(http, auth);
    this.rooms = new RoomsResource(http, auth);
  }
  /** Returns a new client scoped to the given storeId for default report params. */
  forStore(storeId) {
    return new _FlowhubInternalClient({ ...this.config, storeId });
  }
};

// src/internal/drawer-watcher.ts
var DEFAULT_INTERVAL_MS = 5e3;
var DrawerWatcher = class {
  opts;
  intervalMs;
  filterIds;
  previous = /* @__PURE__ */ new Map();
  hasBaseline = false;
  stopped = false;
  sleepAbort;
  constructor(opts) {
    this.opts = opts;
    this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
    this.filterIds = opts.drawerIds ? new Set(opts.drawerIds) : null;
  }
  /**
   * Pre-fetch the baseline snapshot. Optional — if not called, the
   * generator does it on first iteration. Useful when you want to align
   * the baseline to a specific moment (e.g. right after a manual setup
   * step) and then start iterating later.
   */
  async start() {
    if (this.hasBaseline) return;
    const drawers = await this.fetchFiltered();
    this.previous = new Map(drawers.map((d) => [d.id, d]));
    this.hasBaseline = true;
  }
  /**
   * Halt polling. The active iterator will yield `done: true` on its
   * next pull. Idempotent.
   */
  async stop() {
    this.stopped = true;
    this.sleepAbort?.abort();
  }
  events() {
    const generator = this.run();
    const self = this;
    return {
      [Symbol.asyncIterator]() {
        return {
          next: () => generator.next(),
          return: async () => {
            await self.stop();
            return generator.return(void 0);
          },
          throw: (err) => generator.throw(err)
        };
      }
    };
  }
  async *run() {
    if (!this.hasBaseline) {
      try {
        const drawers = await this.fetchFiltered();
        if (this.opts.emitInitial) {
          for (const d of drawers) {
            yield { kind: "drawer.created", drawer: d };
            if (this.stopped) return;
          }
        }
        this.previous = new Map(drawers.map((d) => [d.id, d]));
        this.hasBaseline = true;
      } catch (err) {
        this.opts.onError?.(err);
      }
    }
    while (!this.stopped) {
      await this.sleep(this.intervalMs);
      if (this.stopped) return;
      try {
        const drawers = await this.fetchFiltered();
        const events = computeEvents(this.previous, drawers);
        this.previous = new Map(drawers.map((d) => [d.id, d]));
        for (const event of events) {
          yield event;
          if (this.stopped) return;
        }
      } catch (err) {
        this.opts.onError?.(err);
      }
    }
  }
  async fetchFiltered() {
    const drawers = await this.opts.drawers.list({ hidden: false });
    if (this.filterIds) {
      const f = this.filterIds;
      return drawers.filter((d) => f.has(d.id));
    }
    return drawers;
  }
  async sleep(ms) {
    if (ms <= 0) return;
    const abort = new AbortController();
    this.sleepAbort = abort;
    try {
      await new Promise((resolve) => {
        const timer = setTimeout(() => resolve(), ms);
        abort.signal.addEventListener("abort", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    } finally {
      this.sleepAbort = void 0;
    }
  }
};
var CASH_FIELDS = [
  ["payins", "cash.payIn"],
  ["payouts", "cash.payOut"],
  ["drops", "cash.drop"],
  ["pops", "cash.pop"]
];
function computeEvents(prev, nextList) {
  const events = [];
  const nextMap = new Map(nextList.map((d) => [d.id, d]));
  for (const [id] of prev) {
    if (!nextMap.has(id)) {
      events.push({ kind: "drawer.deleted", drawerId: id });
    }
  }
  for (const drawer of nextList) {
    const previous = prev.get(drawer.id);
    if (!previous) {
      events.push({ kind: "drawer.created", drawer });
      continue;
    }
    if (previous.name !== drawer.name || previous.type !== drawer.type || previous.dropTriggerBalance !== drawer.dropTriggerBalance || !sameIdSet(previous.rooms, drawer.rooms)) {
      events.push({ kind: "drawer.updated", drawer, previous });
    }
    if (previous.openedAt == null && drawer.openedAt != null) {
      events.push({ kind: "drawer.opened", drawer });
    }
    if (previous.closedAt == null && drawer.closedAt != null) {
      events.push({ kind: "drawer.closed", drawer });
    }
    const prevUserIds = new Set(previous.users.map((u) => u.id));
    const nextUserIds = new Set(drawer.users.map((u) => u.id));
    for (const u of drawer.users) {
      if (!prevUserIds.has(u.id)) {
        events.push({ kind: "user.assigned", drawer, user: u });
      }
    }
    for (const u of previous.users) {
      if (!nextUserIds.has(u.id)) {
        events.push({ kind: "user.unassigned", drawer, user: u });
      }
    }
    for (const [field, kind] of CASH_FIELDS) {
      const prevIds = new Set((previous.counts?.[field] ?? []).map((e) => e.id));
      const nextEvents = drawer.counts?.[field] ?? [];
      for (const event of nextEvents) {
        if (!prevIds.has(event.id)) {
          events.push({ kind, drawer, event });
        }
      }
    }
  }
  return events;
}
function sameIdSet(a, b) {
  if (a.length !== b.length) return false;
  const setA = new Set(a.map((x) => x.id));
  for (const x of b) {
    if (!setA.has(x.id)) return false;
  }
  return true;
}

// src/dashboard/index.ts
var FlowhubDashboardClient = FlowhubInternalClient;
var DEFAULT_DASHBOARD_BASE_URL = DEFAULT_INTERNAL_BASE_URL;
export {
  DEFAULT_DASHBOARD_BASE_URL,
  DEFAULT_INTERNAL_BASE_URL,
  DrawerWatcher,
  DrawersResource,
  EmployeesResource,
  FlowhubAuthError,
  FlowhubDashboardClient,
  FlowhubError,
  FlowhubInternalClient,
  FlowhubNotFoundError,
  FlowhubRateLimitError,
  FlowhubValidationError,
  RoomsResource,
  SalesResource,
  UsersResource,
  computeEvents,
  parseCsv,
  parseCsvRaw
};
//# sourceMappingURL=index.js.map