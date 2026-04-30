import type { FlowhubResponse } from "../../src/pagination.js";
import type { Location } from "../../src/types/locations.js";

export const LOCATION_DENVER: Location = {
	address: {
		city: "Denver",
		country: "",
		county: null,
		state: "Colorado",
		streetAddress1: "123 Main Street",
		streetAddress2: null,
		zip: "80014",
	},
	clientId: "0d702b0b-d88f-486d-a1fc-81b8497f72c6",
	clientName: "Blazed and Infused",
	email: "info@blazedandinfused.cannabis",
	hoursOfOperation: null,
	importId: "b334921e-e105-4309-b290-64bc6aad14af",
	licenseType: ["rec", "med"],
	locationId: "b334921e-e105-4309-b290-64bc6aad14af",
	locationLogoURL: null,
	locationName: "Headquarters",
	phoneNumber: "(420) 555-4200",
	timeZone: "US/Mountain",
	website: "www.flowhub.com",
};

export const LOCATION_BOSTON: Location = {
	address: {
		city: "Boston",
		country: "",
		county: null,
		state: "Massachusetts",
		streetAddress1: "123 Main Street",
		streetAddress2: null,
		zip: "02108",
	},
	clientId: "0d702b0b-d88f-486d-a1fc-81b8497f72c7",
	clientName: "Blazed and Infused",
	email: "info@blazedandinfused.cannabis",
	hoursOfOperation: null,
	importId: "b334921e-e105-4309-b290-64bc6aad14ag",
	licenseType: ["rec", "med"],
	locationId: "b334921e-e105-4309-b290-64bc6aad14ag",
	locationLogoURL: null,
	locationName: "Boston Branch",
	phoneNumber: "(420) 555-4200",
	timeZone: "US/Eastern",
	website: "www.flowhub.com",
};

export const LOCATIONS_LIST_RESPONSE: FlowhubResponse<Location> = {
	status: 200,
	data: [LOCATION_DENVER, LOCATION_BOSTON],
};
