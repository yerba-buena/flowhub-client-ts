import { FlowhubClient, FlowhubNotFoundError } from "@yerba-buena/flowhub-client";

const client = new FlowhubClient({
	clientId: process.env.FLOWHUB_CLIENT_ID!,
	apiKey: process.env.FLOWHUB_API_KEY!,
});

// List locations
const { data: locations } = await client.locations.list({ limit: 10 });
console.log(`Found ${locations.length} locations`);

for (const loc of locations) {
	console.log(`  ${loc.locationId}: ${loc.locationName} (${loc.address.city}, ${loc.address.state})`);
}

// Iterate all locations
for await (const loc of client.locations.iterate()) {
	console.log(`  -> ${loc.locationName}`);
}
