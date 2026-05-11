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

describe.skipIf(SKIP)("Orders integration", () => {
	const client = new FlowhubClient({
		clientId: process.env.FLOWHUB_CLIENT_ID!,
		apiKey: process.env.FLOWHUB_API_KEY!,
	});

	describe("Customers", () => {
		it("queries customers list", async () => {
			const result = await client.orders.getCustomers({ page: 1, page_size: 5 });
			// Spec declares single customer-model response; validate we get an object back
			expect(result).toBeDefined();
			expect(typeof result).toBe("object");
		});

		it("finds a customer by phone number", async () => {
			// First get a customer to find their phone number
			const customers = await client.orders.getCustomers({ page: 1, page_size: 1 });
			// Skip if no customers available
			if (!customers || !("phone" in customers) || !customers.phone) return;

			const phoneDigits = customers.phone.replace(/\D/g, "");
			const found = await client.orders.getCustomerByPhone(phoneDigits);
			expect(found).toBeDefined();
			expect(found).toHaveProperty("id");
		});
	});

	describe("Orders (Sales)", () => {
		it("lists orders by location", async () => {
			// Get a location first
			const { data: locations } = await client.locations.list();
			if (locations.length === 0) return;

			const locationId = locations[0]!.locationId;
			const result = await client.orders.listByLocationId(locationId, {
				page: 1,
				page_size: 5,
			});

			expect(result).toHaveProperty("total");
			expect(typeof result.total).toBe("number");
			expect(result).toHaveProperty("orders");
			expect(Array.isArray(result.orders)).toBe(true);
		});

		it("lists orders by customer when customers exist", async () => {
			const customers = await client.orders.getCustomers({ page: 1, page_size: 1 });
			if (!customers || !("id" in customers) || !customers.id) return;

			const result = await client.orders.listByCustomerId(customers.id, {
				page: 1,
				page_size: 5,
			});

			expect(result).toHaveProperty("total");
			expect(typeof result.total).toBe("number");
			expect(result).toHaveProperty("orders");
			expect(Array.isArray(result.orders)).toBe(true);
		});
	});
});
