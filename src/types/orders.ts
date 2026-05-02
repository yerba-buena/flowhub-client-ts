export interface OrderAheadItem {
	readonly productId: string;
	readonly variantId: string;
	readonly quantity: number;
	readonly priceInMinorUnits: number;
}

export interface OrderAheadSubmitParams {
	readonly locationId: string;
	readonly customerId: string;
	readonly items: readonly OrderAheadItem[];
	readonly notes?: string | undefined;
}

export interface OrderAheadActionParams {
	readonly orderId: string;
}

export interface OrderAheadStatusParams {
	readonly orderId: string;
	readonly status: string;
}
