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

interface FlowhubCredentials {
    readonly clientId: string;
    readonly apiKey: string;
    readonly accessToken?: string | undefined;
}

interface HttpClientOptions {
    readonly credentials: FlowhubCredentials;
    readonly baseUrl?: string | undefined;
    readonly timeout?: number | undefined;
    readonly retries?: number | undefined;
    readonly fetchFn?: typeof fetch | undefined;
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
    constructor(options: HttpClientOptions);
    requestText(options: RequestOptions): Promise<string>;
    request<T>(options: RequestOptions): Promise<T>;
    private buildUrl;
    private mapError;
    private parseRetryAfter;
    private calculateDelay;
    private sleep;
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

interface FlowhubClientOptions {
    readonly clientId: string;
    readonly apiKey: string;
    readonly accessToken?: string | undefined;
    readonly baseUrl?: string | undefined;
    readonly timeout?: number | undefined;
    readonly retries?: number | undefined;
}
declare class FlowhubClient {
    readonly locations: LocationsResource;
    readonly inventory: InventoryResource;
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
    cause?: unknown;
}
declare class FlowhubRateLimitError extends FlowhubError {
    readonly retryAfter: number | undefined;
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

/** Base URL for the Flowhub API */
declare const DEFAULT_BASE_URL: "https://api.flowhub.co";
/** Date of the docs snapshot used to generate types */
declare const DOCS_SNAPSHOT_DATE: "2026-04-29";

export { type CannabinoidInfo, type CreateOrderParams, DEFAULT_BASE_URL, DOCS_SNAPSHOT_DATE, FlowhubAuthError, FlowhubClient, type FlowhubClientOptions, FlowhubError, FlowhubNotFoundError, FlowhubRateLimitError, type FlowhubResponse, FlowhubValidationError, type InventoryAnalyticsByRoomItem, type InventoryAnalyticsItem, type InventoryByRoomItem, type InventoryItem, type ListInventoryAnalyticsParams, type Location, type LocationAddress, type OAuthTokenRequest, type OAuthTokenResponse, type OrderAddress, type OrderCustomer, type OrderFee, type OrderItem, type OrderResponse, type OrderStatus, type TerpeneInfo, type UpdateOrderParams };
