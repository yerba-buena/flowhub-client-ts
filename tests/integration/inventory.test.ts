import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

try {
	const envPath = resolve(import.meta.dirname, "../../.env");
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1]!.trim()] = match[2]!.trim();
	}
} catch {}

const SKIP = !process.env.FLOWHUB_API_KEY || !process.env.FLOWHUB_CLIENT_ID;

describe.skipIf(SKIP)("Inventory integration", () => {
	const client = new FlowhubClient({
		clientId: process.env.FLOWHUB_CLIENT_ID!,
		apiKey: process.env.FLOWHUB_API_KEY!,
	});

	it("lists inventory", async () => {
		const result = await client.inventory.list();
		expect(result).toHaveProperty("status");
		expect(result).toHaveProperty("data");
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("lists non-zero inventory", async () => {
		const result = await client.inventory.listNonZero();
		expect(result).toHaveProperty("data");
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("lists inventory analytics", async () => {
		const result = await client.inventory.listAnalytics();
		expect(result).toHaveProperty("data");
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("lists inventory analytics with includesNotForSaleQuantity", async () => {
		const result = await client.inventory.listAnalytics({
			includesNotForSaleQuantity: true,
		});
		expect(result).toHaveProperty("data");
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("lists per-location inventory when locations exist", async () => {
		const { data: locations } = await client.locations.list();
		if (locations.length === 0) return;

		const locationId = locations[0]!.locationId;
		const result = await client.inventory.listByLocation(locationId);
		expect(result).toHaveProperty("data");
		expect(Array.isArray(result.data)).toBe(true);
	});

	it("forLocation scoping routes to per-location endpoint", async () => {
		const { data: locations } = await client.locations.list();
		if (locations.length === 0) return;

		const scoped = client.forLocation(locations[0]!.locationId);
		const result = await scoped.inventory.list();
		expect(result).toHaveProperty("data");
		expect(Array.isArray(result.data)).toBe(true);
	});
});
