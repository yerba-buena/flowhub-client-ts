import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowhubDashboardClient } from "../../src/dashboard/client.js";

try {
	const envPath = resolve(import.meta.dirname, "../../.env");
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1]!.trim()] = match[2]!.trim();
	}
} catch {}

const SKIP = !process.env.FLOWHUB_DASHBOARD_EMAIL || !process.env.FLOWHUB_DASHBOARD_PASSWORD;

describe.skipIf(SKIP)("Dashboard integration", () => {
	const today = new Date().toISOString().slice(0, 10);
	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	function makeClient() {
		return new FlowhubDashboardClient({
			email: process.env.FLOWHUB_DASHBOARD_EMAIL!,
			password: process.env.FLOWHUB_DASHBOARD_PASSWORD!,
			storeId: process.env.FLOWHUB_DASHBOARD_STORE_ID,
		});
	}

	it("authenticates and downloads an accounting report", async () => {
		const client = makeClient();
		const result = await client.reports.downloadAccounting({
			start_date: yesterday,
			end_date: today,
		});

		expect(result.data).toBeInstanceOf(Buffer);
		expect(result.data.length).toBeGreaterThan(0);
		expect(result.filename).toMatch(/\.csv$/);
		expect(result.contentType).toMatch(/text\/plain|text\/csv|octet-stream/);

		// Sanity check: response should look like CSV (contain commas or newlines)
		const text = result.data.toString("utf-8");
		expect(text.length).toBeGreaterThan(0);
	});

	it("reuses the session token across multiple downloads", async () => {
		const client = makeClient();

		const first = await client.reports.downloadAccounting({
			start_date: yesterday,
			end_date: today,
		});

		const second = await client.reports.downloadCategorySales({
			start_date: yesterday,
			end_date: today,
		});

		expect(first.data.length).toBeGreaterThan(0);
		expect(second.data.length).toBeGreaterThan(0);
	});

	it("downloads a report by arbitrary report ID", async () => {
		const client = makeClient();
		const result = await client.reports.downloadReport("end-of-day", {
			start_date: yesterday,
			end_date: today,
		});

		expect(result.data).toBeInstanceOf(Buffer);
		expect(result.data.length).toBeGreaterThan(0);
		expect(result.filename).toBe("end-of-day.csv".replace(".csv", `-${yesterday}-${today}.csv`));
	});
});
