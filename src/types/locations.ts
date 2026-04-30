export interface LocationAddress {
	readonly city: string;
	readonly country: string;
	readonly county: string | null;
	readonly state: string;
	readonly streetAddress1: string;
	readonly streetAddress2: string | null;
	readonly zip: string;
}

export interface Location {
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

export interface ListLocationsParams {
	readonly limit?: number | undefined;
	readonly offset?: number | undefined;
}
