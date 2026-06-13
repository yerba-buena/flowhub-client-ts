import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { FlowhubInternalClient } from "../../src/internal/client.js";

try {
	const envPath = resolve(import.meta.dirname, "../../.env");
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1]!.trim()] = match[2]!.trim();
	}
} catch {}

// Prefer the new FLOWHUB_INTERNAL_* vars; fall back to the legacy
// FLOWHUB_DASHBOARD_* names so existing .env files keep working.
const EMAIL = process.env.FLOWHUB_INTERNAL_EMAIL ?? process.env.FLOWHUB_DASHBOARD_EMAIL;
const PASSWORD = process.env.FLOWHUB_INTERNAL_PASSWORD ?? process.env.FLOWHUB_DASHBOARD_PASSWORD;
const STORE_ID = process.env.FLOWHUB_INTERNAL_STORE_ID ?? process.env.FLOWHUB_DASHBOARD_STORE_ID;

const SKIP = !EMAIL || !PASSWORD;

describe.skipIf(SKIP)("Internal API integration", () => {
	const today = new Date().toISOString().slice(0, 10);
	const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

	function makeClient() {
		return new FlowhubInternalClient({
			email: EMAIL!,
			password: PASSWORD!,
			storeId: STORE_ID,
		});
	}

	it("lists all reports available to the user", async () => {
		const client = makeClient();
		const reports = await client.reports.listReports();

		expect(Array.isArray(reports)).toBe(true);
		expect(reports.length).toBeGreaterThan(0);
		expect(reports[0]).toHaveProperty("reportId");
		expect(reports[0]).toHaveProperty("name");
		expect(reports[0]).toHaveProperty("parameters");

		// Print the full list so the user can see what's available
		// biome-ignore lint/suspicious/noConsole: integration test diagnostic output
		console.log(`\n=== Available reports (${reports.length}) ===`);
		for (const r of reports) {
			const tag = r.isCustom ? " [CUSTOM]" : "";
			const fav = r.isFavorite ? " ⭐" : "";
			// biome-ignore lint/suspicious/noConsole: integration test diagnostic output
			console.log(`  ${r.reportId.padEnd(40)}  ${r.name}${tag}${fav}  (${r.type})`);
		}
	});

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
