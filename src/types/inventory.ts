export interface CannabinoidInfo {
	readonly lowerRange: number;
	readonly name: string;
	readonly unitOfMeasure: string;
	readonly unitOfMeasureToGramsMultiplier: number | string | null;
	readonly upperRange: number;
}

export interface TerpeneInfo {
	readonly lowerRange: number;
	readonly name: string;
	readonly unitOfMeasure: string;
	readonly unitOfMeasureToGramsMultiplier: number;
	readonly upperRange: number;
}

export interface InventoryItem {
	readonly brand: string | null;
	readonly cannabinoidInformation: readonly CannabinoidInfo[];
	readonly category: string;
	readonly clientId: string;
	readonly currencyCode: string;
	readonly customCategoryName: string | null;
	readonly effects: readonly string[];
	readonly expirationDate: string | null;
	readonly inventoryUnitOfMeasure: string;
	readonly inventoryUnitOfMeasureToGramsMultiplier: number | null;
	readonly isMixAndMatch: boolean | null;
	readonly isSoldByWeight: boolean;
	readonly isStackable: boolean | null;
	readonly locationId: string;
	readonly locationName: string;
	readonly nutrients: unknown;
	readonly parentProductId: string;
	readonly parentProductName: string;
	readonly postTaxPriceInPennies: number;
	readonly preTaxPriceInPennies: number;
	readonly priceInMinorUnits: number;
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
	readonly tags: readonly string[];
	readonly terpenes: readonly TerpeneInfo[];
	readonly type: string | null;
	readonly variantId: string;
	readonly variantName: string;
	readonly weightTierInformation: unknown;
}

export interface ListInventoryParams {
	readonly limit?: number | undefined;
	readonly offset?: number | undefined;
	readonly locationId?: string | undefined;
}
