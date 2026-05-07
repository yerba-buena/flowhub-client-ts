import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowhubClient } from "../../src/client.js";

// Load .env from project root if present
try {
	const envPath = resolve(import.meta.dirname, "../../.env");
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1]!.trim()] = match[2]!.trim();
	}
} catch {}

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
