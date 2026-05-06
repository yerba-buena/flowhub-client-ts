import { describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

const SKIP = !process.env.FLOWHUB_API_KEY || !process.env.FLOWHUB_CLIENT_ID;

describe.skipIf(SKIP)("Locations integration", () => {
	const client = new FlowhubClient({
		clientId: process.env.FLOWHUB_CLIENT_ID!,
		apiKey: process.env.FLOWHUB_API_KEY!,
	});

	it("lists locations", async () => {
		const result = await client.locations.list();
		expect(result.data).toBeInstanceOf(Array);
		expect(result.data.length).toBeGreaterThan(0);
	});
});
