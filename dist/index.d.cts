export { F as FlowhubAuthError, a as FlowhubError, b as FlowhubNotFoundError, c as FlowhubRateLimitError, d as FlowhubValidationError } from './errors-DKceN65C.cjs';

interface FlowhubCredentials {
    readonly clientId: string;
    readonly apiKey: string;
    readonly accessToken?: string | undefined;
}

/**
 * Client-side rate limiting for the public Flowhub API.
 *
 * Flowhub enforces a request-rate limit (downstream apps have observed ~59
 * req/s, returning HTTP 429; the exact figure/scope is not published). To avoid
 * tripping it, {@link HttpClient} runs every outbound request through a shared
 * token-bucket limiter. It is configurable and can be disabled.
 */
interface RateLimitOptions {
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
interface RateLimitInfo {
    /** `X-RateLimit-Limit` / `RateLimit-Limit`, if present. */
    readonly limit?: number | undefined;
    /** `X-RateLimit-Remaining` / `RateLimit-Remaining`, if present. */
    readonly remaining?: number | undefined;
    /** Epoch milliseconds when the window resets, if derivable. */
    readonly resetAt?: number | undefined;
    /** Suggested wait before retrying, in milliseconds, if the server indicated one. */
    readonly retryAfterMs?: number | undefined;
}

/** How retry backoff delays are randomized. */
type JitterMode = "full" | "equal" | "none";
interface HttpClientOptions {
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
interface RequestOptions {
    readonly method?: string | undefined;
    readonly path: string;
    readonly query?: Record<string, string | number | boolean | undefined> | undefined;
    readonly body?: unknown;
    readonly signal?: AbortSignal | undefined;
}
declare class HttpClient {
    private readonly baseUrl;
    private readonly timeout;
    private readonly retries;
    private readonly credentials;
    private readonly fetchFn;
    private readonly maxDelayMs;
    private readonly jitter;
    private readonly limiter;
    private readonly onRateLimit;
    constructor(options: HttpClientOptions);
    requestText(options: RequestOptions): Promise<string>;
    request<T>(options: RequestOptions): Promise<T>;
    private buildUrl;
    private mapError;
    /**
     * Read rate-limit signals from response headers. Handles `Retry-After`
     * (delta-seconds or HTTP-date), `Retry-After-Ms`, and the de-facto
     * `X-RateLimit-*` / `RateLimit-*` families (`-Limit`, `-Remaining`,
     * `-Reset` as epoch-seconds or delta-seconds, `-Reset-After` as delta-seconds).
     */
    private readRateLimit;
    private parseRetryAfterMs;
    private notifyRateLimit;
    private rateLimitError;
    /** Delay before the next attempt: honor a server-provided wait, else jittered backoff. */
    private retryDelayMs;
    private calculateDelay;
    private sleep;
}

interface OAuthTokenRequest {
    readonly client_id: string;
    readonly client_secret: string;
    readonly audience: string;
    readonly grant_type: "client_credentials";
}
interface OAuthTokenResponse {
    readonly access_token: string;
    readonly scope: string;
    readonly expires_in: number;
    readonly token_type: string;
}

declare class AuthTokenResource {
    private readonly fetchFn;
    constructor(fetchFn?: typeof fetch | undefined);
    /**
     * POST /oauth/token — Obtain an OAuth2 access token from Auth0.
     *
     * This endpoint is on the Auth0 domain (flowhub.auth0.com), not the main
     * Flowhub API. The returned access_token can be passed as the `accessToken`
     * option when constructing a FlowhubClient to use Order Ahead endpoints.
     */
    getToken(params: OAuthTokenRequest): Promise<OAuthTokenResponse>;
}

interface FlowhubResponse<T> {
    readonly status: number;
    readonly data: readonly T[];
}

interface CannabinoidInfo {
    readonly lowerRange: number;
    readonly name: string;
    readonly unitOfMeasure: string;
    readonly unitOfMeasureToGramsMultiplier: number | string | null;
    readonly upperRange: number;
}
interface TerpeneInfo {
    readonly lowerRange: number;
    readonly name: string;
    readonly unitOfMeasure: string;
    readonly unitOfMeasureToGramsMultiplier: number;
    readonly upperRange: number;
}
interface InventoryItem {
    readonly brand: string | null;
    readonly cannabinoidInformation: readonly CannabinoidInfo[];
    readonly category: string;
    readonly clientId: string;
    readonly costInMinorUnits: number;
    readonly createdAt: string;
    readonly currencyCode: string;
    readonly customCategoryName: string | null;
    readonly effects: readonly string[];
    readonly expirationDate: string | null;
    readonly inventoryUnitOfMeasure: string;
    readonly inventoryUnitOfMeasureToGramsMultiplier: number | null;
    readonly invoiceNumber: string | null;
    readonly isMixAndMatch: boolean | null;
    readonly isSoldByWeight: boolean;
    readonly isStackable: boolean | null;
    readonly locationId: string;
    readonly locationName: string;
    readonly manifestId: string | null;
    readonly nutrients: unknown;
    readonly parentProductId: string;
    readonly parentProductName: string;
    readonly postTaxPriceInPennies: number;
    readonly preTaxPriceInPennies: number;
    readonly priceInMinorUnits: number;
    readonly priceProfileName: string | null;
    readonly productDescription: string;
    readonly productId: string;
    readonly productName: string;
    readonly productPictureURL: string | null;
    readonly productUnitOfMeasure: string;
    readonly productUnitOfMeasureToGramsMultiplier: number | null;
    readonly productUpdatedAt: string;
    readonly productWeight: number;
    readonly purchaseCategory: string;
    readonly quantity: number;
    readonly regulatoryId: string;
    readonly sku: string;
    readonly speciesName: string | null;
    readonly strainName: string | null;
    readonly supplierName: string | null;
    readonly tags: readonly string[];
    readonly terpenes: readonly TerpeneInfo[];
    readonly type: string | null;
    readonly variantId: string;
    readonly variantName: string;
    readonly weightTierInformation: unknown;
}
interface InventoryByRoomItem extends InventoryItem {
    readonly roomId: string;
    readonly roomName: string;
    readonly upc: string | null;
}
interface InventoryAnalyticsItem extends InventoryItem {
    readonly forSale: boolean;
    readonly supplierLicense: string | null;
}
interface InventoryAnalyticsByRoomItem extends InventoryByRoomItem {
    readonly forSale: boolean;
    readonly supplierLicense: string | null;
}
/** Query parameters for inventory analytics endpoints. */
interface ListInventoryAnalyticsParams {
    readonly includesNotForSaleQuantity?: boolean | undefined;
}

declare class InventoryResource {
    private readonly http;
    private readonly scopedLocationId;
    constructor(http: HttpClient, locationId?: string | undefined);
    private inventoryPath;
    list(): Promise<FlowhubResponse<InventoryItem>>;
    listNonZero(): Promise<FlowhubResponse<InventoryItem>>;
    listByRoomsNonZero(): Promise<FlowhubResponse<InventoryByRoomItem>>;
    listAnalytics(params?: ListInventoryAnalyticsParams): Promise<FlowhubResponse<InventoryAnalyticsItem>>;
    listAnalyticsByRooms(params?: ListInventoryAnalyticsParams): Promise<FlowhubResponse<InventoryAnalyticsByRoomItem>>;
    listByLocation(locationId: string): Promise<FlowhubResponse<InventoryItem>>;
    listByLocationNonZero(locationId: string): Promise<FlowhubResponse<InventoryItem>>;
    listByLocationByRoomsNonZero(locationId: string): Promise<FlowhubResponse<InventoryByRoomItem>>;
    listAnalyticsByLocation(locationId: string, params?: ListInventoryAnalyticsParams): Promise<FlowhubResponse<InventoryAnalyticsItem>>;
    listAnalyticsByLocationByRooms(locationId: string, params?: ListInventoryAnalyticsParams): Promise<FlowhubResponse<InventoryAnalyticsByRoomItem>>;
}

interface LocationAddress {
    readonly city: string;
    readonly country: string;
    readonly county: string | null;
    readonly state: string;
    readonly streetAddress1: string;
    readonly streetAddress2: string | null;
    readonly zip: string;
}
interface Location {
    readonly address: LocationAddress;
    readonly clientId: string;
    readonly clientName: string;
    readonly email: string;
    readonly hoursOfOperation: string | null;
    readonly importId: string;
    readonly licenseType: readonly string[];
    readonly locationId: string;
    readonly locationLogoURL: string | null;
    readonly locationName: string;
    readonly phoneNumber: string;
    readonly timeZone: string;
    readonly website: string;
}

declare class LocationsResource {
    private readonly http;
    constructor(http: HttpClient);
    list(): Promise<FlowhubResponse<Location>>;
}

interface OrderAddress {
    readonly street1: string;
    readonly street2?: string | undefined;
    readonly city: string;
    readonly state: string;
    readonly zip: string;
}
interface OrderCustomer {
    readonly firstName?: string | undefined;
    readonly lastName?: string | undefined;
    readonly birthDate?: string | undefined;
    readonly externalId?: string | undefined;
    readonly email?: string | undefined;
    /** E.164 formatted phone number */
    readonly phone?: string | undefined;
    readonly medRecOrBoth?: "med" | "rec" | "both" | undefined;
    /** Required when customer is medical */
    readonly medId?: string | undefined;
    /** Required when medId is present */
    readonly medExp?: string | undefined;
}
interface OrderItem {
    readonly productId: number;
    readonly quantityPurchased: number;
    readonly discountNote?: string | undefined;
}
interface OrderFee {
    readonly name?: string | undefined;
    /** Amount in pennies */
    readonly amount?: number | undefined;
}
interface CreateOrderParams {
    readonly externalCreatedAt: string;
    readonly customer: OrderCustomer;
    readonly orderItems: readonly OrderItem[];
    readonly address?: OrderAddress | undefined;
    /** Required if redeeming loyalty points */
    readonly customerId?: string | undefined;
    readonly cartDiscountNote?: string | undefined;
    readonly customerNote?: string | undefined;
    readonly orderType?: "delivery" | "pickup" | "kiosk" | undefined;
    readonly requestedFulfillmentTimeStart?: string | undefined;
    readonly requestedFulfillmentTimeEnd?: string | undefined;
    /** URL to receive order status updates */
    readonly postbackUrl?: string | undefined;
    readonly fees?: readonly OrderFee[] | undefined;
    /** Value of loyalty points to redeem in pennies. Requires customerId. */
    readonly loyaltyPointsInPennies?: number | undefined;
}
interface UpdateOrderParams extends CreateOrderParams {
}
type OrderStatus = "new" | "started" | "ready" | "inQueue" | "inTransit" | "delivered" | "unableToComplete" | "unableToVerify" | "deleted" | "sold";
interface OrderResponse {
    readonly customerExternalId: string;
    readonly orderId: string;
    readonly status: OrderStatus;
}

declare class OrderAheadResource {
    private readonly http;
    constructor(http: HttpClient);
    /** POST /order-ahead/v0/create — Submit a new order ahead */
    create(params: CreateOrderParams): Promise<OrderResponse>;
    /** PATCH /orders/{orderId} — Update an existing order */
    update(orderId: string, params: UpdateOrderParams): Promise<OrderResponse>;
    /** POST /orderPostback/{orderId} — Trigger order postback (returns 204) */
    postback(orderId: string): Promise<void>;
    /** GET /order-ahead/v0/orderStatus/{orderId} — Get order status */
    getStatus(orderId: string): Promise<OrderResponse>;
    /** GET /authTest — Test authentication (returns text) */
    testAuth(): Promise<string>;
    /** GET /health — Service health check (returns text) */
    health(): Promise<string>;
}

interface CustomerGroup {
    readonly name: string;
}
interface Customer {
    readonly id: string;
    readonly createdAt: string;
    readonly updatedAt: string;
    readonly type: "medCustomer" | "recCustomer";
    readonly name: string;
    readonly state: string;
    readonly birthDate: string;
    readonly isLoyal: boolean;
    readonly loyaltyPoints: number;
    /** Only present when store_id is included in request params and a loyalty program exists at that location. */
    readonly loyaltyPointsInPennies?: number | undefined;
    readonly phone: string;
    readonly email: string;
    readonly streetAddress1: string;
    readonly streetAddress2: string;
    readonly city: string;
    readonly zip: string;
    readonly country: string;
    readonly consentsToPromotionalEmail: boolean;
    readonly consentsToPromotionalSMS: boolean;
    readonly groups: readonly CustomerGroup[];
}
interface CustomerWriteParams {
    /** yyyy-mm-dd format */
    readonly birthDate: string;
    /** Full name (first & last) */
    readonly name: string;
    /** 2-letter state abbreviation */
    readonly state: string;
    readonly type: string;
    readonly city?: string | undefined;
    readonly consentsToPromotionalEmail?: boolean | undefined;
    readonly consentsToPromotionalSMS?: boolean | undefined;
    readonly email?: string | undefined;
    readonly groups?: readonly {
        readonly groupId?: string | undefined;
    }[] | undefined;
    readonly isLoyal?: boolean | undefined;
    readonly loyaltyPoints?: number | undefined;
    readonly medId?: string | undefined;
    /** yyyy-mm-dd format */
    readonly medIdExpiration?: string | undefined;
    readonly phone?: string | undefined;
    readonly stateId?: string | undefined;
    /** yyyy-mm-dd format */
    readonly stateIdExpiration?: string | undefined;
    readonly streetAddress1?: string | undefined;
    readonly streetAddress2?: string | undefined;
    readonly zip?: string | undefined;
}
interface PaginationParams {
    /**
     * Lower date bound for list endpoints (e.g. `listByLocationId`). Use this to
     * fetch a bounded window (a single week) instead of paginating an entire
     * location's order history — the single biggest lever for staying under the
     * API rate limit. ISO 8601 / `YYYY-MM-DD`.
     *
     * Note: server-side honoring of these bounds on the orders endpoints is not
     * documented in `flowhub-api-docs`; confirm against a live response for your
     * account. The client always forwards them as query params.
     */
    readonly created_after?: string | undefined;
    /** Upper date bound for list endpoints. See {@link PaginationParams.created_after}. */
    readonly created_before?: string | undefined;
    readonly page?: number | undefined;
    readonly page_size?: number | undefined;
    readonly order_by?: "asc" | "desc" | undefined;
}
interface CustomersListParams extends PaginationParams {
    readonly updated_after?: string | undefined;
    readonly updated_before?: string | undefined;
}
interface SaleTotals {
    readonly FinalTotal: number;
    readonly SubTotal: number;
    readonly TotalDiscounts: number;
    readonly TotalFees: number;
    readonly TotalTaxes: number;
}
interface SaleTax {
    readonly _id: string;
    readonly name: string;
    readonly percentage: number;
    readonly calculateBeforeDiscounts: string;
    readonly supplierSpecificTax: boolean;
    readonly excludeCustomerGroups: readonly string[];
    readonly enableCostMarkup: boolean;
    readonly markupPercentage: number;
    readonly thisTaxInPennies: number;
    readonly appliesTo: string;
}
interface SaleItemDiscount {
    readonly _id: string;
    readonly name: string;
    readonly type: string;
    readonly discountAmount: number;
    readonly discountType: string;
    readonly discountId: string;
    readonly dollarsOff: number;
    readonly penniesOff: number;
    readonly percentOff: number;
    readonly discounterName: string;
    readonly discounterId: string;
    readonly isCartDiscount: boolean;
    readonly couponCode: string;
    readonly quantity: number;
}
interface SaleItem {
    readonly id: string;
    readonly category: string;
    readonly itemDiscounts: readonly SaleItemDiscount[];
    readonly parentProductId: string;
    readonly productId: string;
    readonly productName: string;
    readonly quantity: number;
    readonly strainName: string;
    readonly sku: string;
    readonly tax: readonly SaleTax[];
    readonly title1: string;
    readonly title2: string;
    readonly totalCost: number;
    readonly totalPrice: number;
    readonly unitOfWeight: string;
    readonly unitPrice: number;
    readonly unitCost: number;
    readonly variantId: string;
    readonly brand: string;
    readonly type: string;
}
interface SalePayment {
    readonly _id: string;
    readonly paymentType: string;
    readonly amount: number;
    readonly cardId: string;
    readonly loyaltyPoints: number;
    readonly debitProvider: string;
    readonly balanceAfterPayment: number;
}
interface Sale {
    readonly id: string;
    readonly budtender: string;
    readonly budtenderId: string;
    readonly clientId: string;
    readonly createdAt: string;
    readonly completedOn: string;
    readonly currentPoints: number;
    readonly customerId: string;
    readonly customerType: "recCustomer" | "medCustomer";
    readonly fulfilledBy: string;
    readonly fulfilledById: string;
    readonly fullName: string;
    readonly integratorId: string;
    readonly itemsInCart: readonly SaleItem[];
    readonly locationId: string;
    readonly name: string;
    readonly orderId: string;
    readonly orderStatus: "Pending" | "Cancelled" | "Sold";
    readonly orderType: string;
    readonly originalSaleId: string;
    readonly payments: readonly SalePayment[];
    readonly sentToFulfillmentBy: string;
    readonly sentToFulfillmentById: string;
    readonly totals: SaleTotals;
    readonly voided: boolean;
}
interface OrdersListResponse {
    readonly total: number;
    readonly orders: readonly Sale[];
}

declare class OrdersResource {
    private readonly http;
    constructor(http: HttpClient);
    /**
     * GET /v1/customers/ — Query customers.
     *
     * The spec declares a single customer-model response for this endpoint.
     * The actual API may return an array or paginated envelope — adjust the
     * return type once validated against a live response.
     */
    getCustomers(params?: CustomersListParams): Promise<Customer>;
    /** GET /v1/customers/{customerId} — Get a customer by ID */
    getCustomerById(customerId: string, opts?: {
        store_id?: string | undefined;
    }): Promise<Customer>;
    /** GET /v1/customers/findByPhoneNumber — Get a customer by phone number */
    getCustomerByPhone(phoneNumber: string): Promise<Customer>;
    /** POST /v1/customer?store_id={store_id} — Create a customer */
    createCustomer(storeId: string, params: CustomerWriteParams): Promise<Customer>;
    /** PUT /v1/customer/{customerId}?store_id={store_id} — Update a customer */
    updateCustomer(customerId: string, storeId: string, params: CustomerWriteParams): Promise<Customer>;
    /** GET /v1/orders/findByCustomerId/{customerId} — List orders for a customer */
    listByCustomerId(customerId: string, params?: PaginationParams): Promise<OrdersListResponse>;
    /** GET /v1/orders/findByLocationId/{importId} — List orders for a location */
    listByLocationId(importId: string, params?: PaginationParams): Promise<OrdersListResponse>;
}

interface FlowhubClientOptions {
    readonly clientId: string;
    readonly apiKey: string;
    readonly accessToken?: string | undefined;
    readonly baseUrl?: string | undefined;
    readonly timeout?: number | undefined;
    readonly retries?: number | undefined;
    /**
     * Custom `fetch` implementation used for all outbound requests (main API and
     * the Auth0 token endpoint). Defaults to `globalThis.fetch`.
     *
     * This is the extension point for SSRF-safe egress: pass a `fetch` wired to a
     * connection layer you control (e.g. an `undici` `Agent` with a pinned
     * `connect.lookup`) so you can resolve-validate-and-pin the destination IP and
     * close the DNS-rebinding window. See the README's "Custom fetch / SSRF
     * hardening" section for a recipe.
     */
    readonly fetchFn?: typeof fetch | undefined;
    /** Cap on a single retry backoff delay, in ms. Default 30000. */
    readonly maxDelayMs?: number | undefined;
    /** Backoff randomization: `"full"` (default), `"equal"`, or `"none"`. */
    readonly jitter?: JitterMode | undefined;
    /**
     * Client-side request throttle for the public Flowhub API, which rejects
     * bursts with HTTP 429. Defaults to a conservative ~45 req/s; pass
     * `{ rps: 0 }` to disable, or raise `rps`/`burst` if your key allows.
     */
    readonly rateLimit?: RateLimitOptions | undefined;
    /** Called when the server returns rate-limit headers, so you can self-pace. */
    readonly onRateLimit?: ((info: RateLimitInfo) => void) | undefined;
}
declare class FlowhubClient {
    readonly locations: LocationsResource;
    readonly inventory: InventoryResource;
    readonly orders: OrdersResource;
    readonly orderAhead: OrderAheadResource;
    readonly authToken: AuthTokenResource;
    /** The locationId this client is scoped to, if any. */
    readonly locationId: string | undefined;
    private readonly http;
    private readonly options;
    constructor(options: FlowhubClientOptions, locationId?: string | undefined);
    /**
     * Returns a new client scoped to a specific location.
     * The scoped client's inventory methods use /v0/locations/{locationId}/... endpoints.
     */
    forLocation(locationId: string): FlowhubClient;
}

/** Base URL for the Flowhub API */
declare const DEFAULT_BASE_URL: "https://api.flowhub.co";
/** Date of the docs snapshot used to generate types */
declare const DOCS_SNAPSHOT_DATE: "2026-05-07";

export { type CannabinoidInfo, type CreateOrderParams, type Customer, type CustomerGroup, type CustomerWriteParams, type CustomersListParams, DEFAULT_BASE_URL, DOCS_SNAPSHOT_DATE, FlowhubClient, type FlowhubClientOptions, type FlowhubResponse, type InventoryAnalyticsByRoomItem, type InventoryAnalyticsItem, type InventoryByRoomItem, type InventoryItem, type JitterMode, type ListInventoryAnalyticsParams, type Location, type LocationAddress, type OAuthTokenRequest, type OAuthTokenResponse, type OrderAddress, type OrderCustomer, type OrderFee, type OrderItem, type OrderResponse, type OrderStatus, type OrdersListResponse, type PaginationParams, type RateLimitInfo, type RateLimitOptions, type Sale, type SaleItem, type SaleItemDiscount, type SalePayment, type SaleTax, type SaleTotals, type TerpeneInfo, type UpdateOrderParams };
