import { FlowhubClient } from "@yerba-buena/flowhub-client";

const client = new FlowhubClient({
	clientId: process.env.FLOWHUB_CLIENT_ID!,
	apiKey: process.env.FLOWHUB_API_KEY!,
});

// List locations
const { data: locations } = await client.locations.list({ limit: 10 });
console.log(`Found ${locations.length} locations`);

for (const loc of locations) {
	console.log(
		`  ${loc.locationId}: ${loc.locationName} (${loc.address.city}, ${loc.address.state})`,
	);
}

// Iterate all locations
for await (const loc of client.locations.iterate()) {
	console.log(`  -> ${loc.locationName}`);
}

// List inventory for a location
const { data: inventory } = await client.inventory.list({
	locationId: locations[0]!.locationId,
	limit: 5,
});
console.log(`\nFound ${inventory.length} inventory items`);

for (const item of inventory) {
	console.log(`  ${item.productName} (${item.category}) - qty: ${item.quantity}`);
}

// Order Ahead (requires OAuth2 accessToken)
// const oauthClient = new FlowhubClient({
// 	clientId: process.env.FLOWHUB_CLIENT_ID!,
// 	apiKey: process.env.FLOWHUB_API_KEY!,
// 	accessToken: "your-oauth-token",
// });
// await oauthClient.orderAhead.submit({ locationId: "...", customerId: "...", items: [] });
