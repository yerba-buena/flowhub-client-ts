import { FlowhubClient } from "@yerba-buena/flowhub-client";

const client = new FlowhubClient({
	clientId: process.env.FLOWHUB_CLIENT_ID!,
	apiKey: process.env.FLOWHUB_API_KEY!,
});

// ── Locations ────────────────────────────────────────────────────────

const { data: locations } = await client.locations.list();
console.log(`Found ${locations.length} locations`);

for (const loc of locations) {
	console.log(
		`  ${loc.locationId}: ${loc.locationName} (${loc.address.city}, ${loc.address.state})`,
	);
}

// ── Inventory ────────────────────────────────────────────────────────

const { data: inventory } = await client.inventory.list();
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

// Per-location inventory
const { data: locItems } = await client.inventory.listByLocation(locations[0]!.locationId);
console.log(`\n${locItems.length} items at first location`);

// Location-scoped client (all inventory methods route to per-location endpoints)
const scoped = client.forLocation(locations[0]!.locationId);
const { data: scopedItems } = await scoped.inventory.list();
console.log(`${scopedItems.length} items at first location (via scoped client)`);

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
