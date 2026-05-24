import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CountRecord, Drawer } from "../../src/dashboard/cash-management-types.js";
import { FlowhubDashboardClient } from "../../src/dashboard/client.js";

/*
 * Live cash-management integration tests.
 *
 * THESE TESTS HIT THE REAL FLOWHUB PRODUCTION INSTANCE. They mutate state
 * on a designated test drawer. They are gated behind FOUR env vars (all
 * required) so a stray FLOWHUB_LIVE_TEST=1 in a developer's shell can't
 * trigger a run, and so a misconfigured run is impossible:
 *
 *   FLOWHUB_LIVE_TEST=1
 *   FLOWHUB_TEST_DRAWER_ID=<uuid of a non-customer-facing test drawer>
 *   FLOWHUB_TEST_USER_ID=<uuid of a service-account user>
 *   FLOWHUB_LIVE_TEST_CONFIRM=I-UNDERSTAND-THIS-HITS-PRODUCTION
 *
 * Plus the standard FLOWHUB_DASHBOARD_EMAIL / FLOWHUB_DASHBOARD_PASSWORD
 * credentials.
 *
 * Pre-flight (run manually, once):
 *   1. In the Flowhub dashboard, create a drawer named DO-NOT-USE-AUTOMATED-TEST
 *      in a non-customer-facing room. Assign no users initially. Confirm it is
 *      currently closed.
 *   2. Set FLOWHUB_TEST_DRAWER_ID to its UUID.
 *   3. Use a service-account user (not a real cashier). Set FLOWHUB_TEST_USER_ID
 *      to that user's UUID.
 *
 * Per-test hygiene:
 *   - Counts use total: 1 (one cent), denominations: { pennies: 1 } and notes
 *     beginning with AUTOMATED-TEST so anything that leaks is obvious.
 *   - beforeAll asserts the drawer is currently closed and has no users
 *     assigned (refuses to run if a previous failed run left state behind).
 *   - afterAll runs a best-effort cleanup pass: close if open, unassign all.
 */

try {
	const envPath = resolve(import.meta.dirname, "../../.env");
	for (const line of readFileSync(envPath, "utf-8").split("\n")) {
		const match = line.match(/^([^#=]+)=(.*)$/);
		if (match) process.env[match[1]!.trim()] = match[2]!.trim();
	}
} catch {}

const REQUIRED_CONFIRMATION = "I-UNDERSTAND-THIS-HITS-PRODUCTION";

const SKIP =
	process.env.FLOWHUB_LIVE_TEST !== "1" ||
	process.env.FLOWHUB_LIVE_TEST_CONFIRM !== REQUIRED_CONFIRMATION ||
	!process.env.FLOWHUB_TEST_DRAWER_ID ||
	!process.env.FLOWHUB_TEST_USER_ID ||
	!process.env.FLOWHUB_DASHBOARD_EMAIL ||
	!process.env.FLOWHUB_DASHBOARD_PASSWORD;

const TEST_NOTE_PREFIX = "AUTOMATED-TEST FAKE DATA";

function tinyCount(notes: string): CountRecord {
	return {
		total: 1,
		notes: `${TEST_NOTE_PREFIX} — ${notes}`,
		denominations: {
			pennies: 1,
			nickels: 0,
			dimes: 0,
			quarters: 0,
			ones: 0,
			twos: 0,
			fives: 0,
			tens: 0,
			twenties: 0,
			fifties: 0,
			hundreds: 0,
		},
	};
}

function isOpen(drawer: Drawer | null): boolean {
	return drawer != null && drawer.openedAt != null && drawer.closedAt == null;
}

describe.skipIf(SKIP)("Cash management live integration", () => {
	const drawerId = process.env.FLOWHUB_TEST_DRAWER_ID!;
	const userId = process.env.FLOWHUB_TEST_USER_ID!;

	function makeClient() {
		return new FlowhubDashboardClient({
			email: process.env.FLOWHUB_DASHBOARD_EMAIL!,
			password: process.env.FLOWHUB_DASHBOARD_PASSWORD!,
		});
	}

	beforeAll(async () => {
		const client = makeClient();
		const drawer = await client.drawers.get(drawerId);
		if (drawer == null) {
			throw new Error(
				`Pre-flight failed: test drawer ${drawerId} not found. Check FLOWHUB_TEST_DRAWER_ID.`,
			);
		}
		if (drawer.openedAt != null && drawer.closedAt == null) {
			throw new Error(
				`Pre-flight failed: test drawer ${drawerId} is currently OPEN. Close it manually in the dashboard before running live tests so a previous failed run can't compound.`,
			);
		}
		if (drawer.users.length > 0) {
			throw new Error(
				`Pre-flight failed: test drawer ${drawerId} has ${drawer.users.length} user(s) assigned. Unassign them manually before running live tests.`,
			);
		}
	});

	afterAll(async () => {
		const client = makeClient();
		try {
			const drawer = await client.drawers.get(drawerId);
			if (drawer == null) return;
			if (isOpen(drawer)) {
				try {
					await client.drawers.close(drawerId, tinyCount("afterAll cleanup close"));
				} catch {
					// best effort
				}
			}
			for (const u of drawer.users) {
				try {
					await client.drawers.unassignUser(drawerId, u.id);
				} catch {
					// best effort
				}
			}
		} catch {
			// best effort
		}
	});

	it("get() returns the test drawer", async () => {
		const client = makeClient();
		const drawer = await client.drawers.get(drawerId);
		expect(drawer).not.toBeNull();
		expect(drawer?.id).toBe(drawerId);
	});

	it("list() includes the test drawer", async () => {
		const client = makeClient();
		const drawers = await client.drawers.list();
		expect(drawers.some((d) => d.id === drawerId)).toBe(true);
	});

	it("assignUser then unassignUser round-trips the test user", async () => {
		const client = makeClient();
		const assigned = await client.drawers.assignUser(drawerId, userId);
		expect(assigned.users.map((u) => u.id)).toContain(userId);

		const unassigned = await client.drawers.unassignUser(drawerId, userId);
		expect(unassigned.users.map((u) => u.id)).not.toContain(userId);
	});

	it("open then close round-trips the drawer lifecycle", async () => {
		const client = makeClient();

		const opened = await client.drawers.open(drawerId, tinyCount("open test"));
		expect(opened.openedAt).not.toBeNull();
		expect(opened.closedAt).toBeNull();
		expect(opened.counts).not.toBeNull();
		expect(opened.counts?.openingCounts?.total).toBe(1);

		const closed = await client.drawers.close(drawerId, tinyCount("close test"));
		expect(closed.closedAt).not.toBeNull();
		expect(closed.counts?.ClosedAt).not.toBeNull();
		expect(closed.counts?.closingCounts?.total).toBe(1);
	});
});
