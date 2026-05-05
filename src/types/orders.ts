export interface OrderAddress {
	readonly street1: string;
	readonly street2?: string | undefined;
	readonly city: string;
	readonly state: string;
	readonly zip: string;
}

export interface OrderCustomer {
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

export interface OrderItem {
	readonly productId: number;
	readonly quantityPurchased: number;
	readonly discountNote?: string | undefined;
}

export interface OrderFee {
	readonly name?: string | undefined;
	/** Amount in pennies */
	readonly amount?: number | undefined;
}

export interface CreateOrderParams {
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

export interface UpdateOrderParams extends CreateOrderParams {}

export type OrderStatus =
	| "new"
	| "started"
	| "ready"
	| "inQueue"
	| "inTransit"
	| "delivered"
	| "unableToComplete"
	| "unableToVerify"
	| "deleted"
	| "sold";

export interface OrderResponse {
	readonly customerExternalId: string;
	readonly orderId: string;
	readonly status: OrderStatus;
}
