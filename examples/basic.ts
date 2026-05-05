import { FlowhubClient } from "@yerba-buena/flowhub-client";

const client = new FlowhubClient({
	clientId: process.env.FLOWHUB_CLIENT_ID!,
	apiKey: process.env.FLOWHUB_API_KEY!,
});

// ── Locations ────────────────────────────────────────────────────────

const { data: locations } = await client.locations.list({ limit: 10 });
console.log(`Found ${locations.length} locations`);

for (const loc of locations) {
	console.log(
		`  ${loc.locationId}: ${loc.locationName} (${loc.address.city}, ${loc.address.state})`,
	);
}

// Iterate all locations (auto-paginated)
for await (const loc of client.locations.iterate()) {
	console.log(`  -> ${loc.locationName}`);
}

// ── Inventory ────────────────────────────────────────────────────────

// List all inventory with pagination
const { data: inventory } = await client.inventory.list({
	locationId: locations[0]!.locationId,
	limit: 5,
});
console.log(`\nFound ${inventory.length} inventory items`);

for (const item of inventory) {
	console.log(`  ${item.productName} (${item.category}) - qty: ${item.quantity}`);
}

// Non-zero inventory only
const { data: inStock } = await client.inventory.listNonZero();
console.log(`\n${inStock.length} items in stock`);

// Inventory analytics with not-for-sale quantities
const { data: analytics } = await client.inventory.listAnalytics({
	includesNotForSaleQuantity: true,
});
console.log(`\n${analytics.length} analytics items`);

// Location-scoped inventory (using forLocation)
const scoped = client.forLocation(locations[0]!.locationId);
const { data: scopedItems } = await scoped.inventory.list();
console.log(`\n${scopedItems.length} items at first location`);

// Iterate all inventory (auto-paginated)
for await (const item of client.inventory.iterate({ limit: 100 })) {
	console.log(`  ${item.productName}: ${item.quantity}`);
}

// ── Order Ahead (requires accessToken) ───────────────────────────────

// const oauthClient = new FlowhubClient({
// 	clientId: process.env.FLOWHUB_CLIENT_ID!,
// 	apiKey: process.env.FLOWHUB_API_KEY!,
// 	accessToken: process.env.FLOWHUB_ACCESS_TOKEN!,
// });
//
// const order = await oauthClient.orderAhead.create({
// 	externalCreatedAt: new Date().toISOString(),
// 	customer: {
// 		firstName: "Jane",
// 		lastName: "Doe",
// 		email: "jane@example.com",
// 		phone: "+15551234567",
// 		medRecOrBoth: "rec",
// 	},
// 	orderItems: [{ productId: 42, quantityPurchased: 1 }],
// 	orderType: "pickup",
// });
//
// const status = await oauthClient.orderAhead.getStatus(order.orderId);
// console.log(`Order status: ${status.status}`);
