import { describe, expect, it } from "vitest";
import type {
	CashEvent,
	Drawer,
	DrawerEvent,
	DrawerSource,
} from "../../src/dashboard/cash-management-types.js";
import { DrawerWatcher, computeEvents } from "../../src/dashboard/drawer-watcher.js";

/* -------------------------------------------------------------------------
 * Test helpers
 * ----------------------------------------------------------------------- */

function makeDrawer(overrides: Partial<Drawer> = {}): Drawer {
	const base: Drawer = {
		id: "drawer-1",
		name: "Drawer 1",
		type: "REC",
		openedAt: null,
		closedAt: null,
		dropTriggerBalance: 100000,
		needsDrop: false,
		rooms: [{ id: "room-1", name: "Front" }],
		users: [],
		counts: null,
	};
	return { ...base, ...overrides };
}

function makeCounts(overrides: Partial<NonNullable<Drawer["counts"]>> = {}) {
	return {
		id: "count-1",
		drawerId: "drawer-1",
		openedAt: "2026-05-24T09:00:00Z",
		openedByUser: null,
		ClosedAt: null,
		closedByUser: null,
		openingCashBalance: 0,
		cashBalance: 0,
		closingCashBalance: 0,
		openingCounts: null,
		closingCounts: null,
		cashRevenue: 0,
		debitRevenue: 0,
		achRevenue: 0,
		giftCardRevenue: 0,
		debitBalance: 0,
		achBalance: 0,
		debitTipRevenue: 0,
		closingDebitBalance: 0,
		closingRevenue: 0,
		payins: [],
		payouts: [],
		drops: [],
		pops: [],
		totalPaidIn: 0,
		totalPaidOut: 0,
		totalDropped: 0,
		totalRevenueSinceOpen: 0,
		...overrides,
	};
}

function makeCashEvent(id: string, overrides: Partial<CashEvent> = {}): CashEvent {
	return {
		id,
		total: 100,
		reason: "test",
		timestamp: "2026-05-24T10:00:00.000Z",
		user_id: "user-1",
		balance_before: 0,
		balance_after: 100,
		...overrides,
	};
}

/* -------------------------------------------------------------------------
 * computeEvents — pure diff algorithm
 * ----------------------------------------------------------------------- */

describe("computeEvents", () => {
	it("emits nothing when snapshots are identical", () => {
		const d = makeDrawer();
		const prev = new Map([[d.id, d]]);
		expect(computeEvents(prev, [d])).toEqual([]);
	});

	it("emits drawer.created for new drawers", () => {
		const prev = new Map<string, Drawer>();
		const d = makeDrawer();
		const events = computeEvents(prev, [d]);
		expect(events).toEqual([{ kind: "drawer.created", drawer: d }]);
	});

	it("emits drawer.deleted for drawers gone from the new snapshot", () => {
		const d = makeDrawer();
		const prev = new Map([[d.id, d]]);
		const events = computeEvents(prev, []);
		expect(events).toEqual([{ kind: "drawer.deleted", drawerId: d.id }]);
	});

	it("emits drawer.opened when openedAt transitions null → string", () => {
		const before = makeDrawer({ openedAt: null });
		const after = makeDrawer({ openedAt: "2026-05-24T09:00:00Z" });
		const events = computeEvents(new Map([[before.id, before]]), [after]);
		expect(events).toEqual([{ kind: "drawer.opened", drawer: after }]);
	});

	it("emits drawer.closed when closedAt transitions null → string", () => {
		const before = makeDrawer({ openedAt: "2026-05-24T09:00:00Z", closedAt: null });
		const after = makeDrawer({
			openedAt: "2026-05-24T09:00:00Z",
			closedAt: "2026-05-24T17:00:00Z",
		});
		const events = computeEvents(new Map([[before.id, before]]), [after]);
		expect(events).toEqual([{ kind: "drawer.closed", drawer: after }]);
	});

	it("emits drawer.updated for name / type / dropTriggerBalance / rooms changes", () => {
		const before = makeDrawer({
			name: "Old",
			type: "REC",
			dropTriggerBalance: 100000,
			rooms: [{ id: "room-1", name: "Front" }],
		});
		const after = makeDrawer({
			name: "New",
			type: "MED",
			dropTriggerBalance: 200000,
			rooms: [{ id: "room-2", name: "Back" }],
		});
		const events = computeEvents(new Map([[before.id, before]]), [after]);
		expect(events).toEqual([{ kind: "drawer.updated", drawer: after, previous: before }]);
	});

	it("does NOT emit drawer.updated for rooms reordered without membership change", () => {
		const before = makeDrawer({
			rooms: [
				{ id: "a", name: "A" },
				{ id: "b", name: "B" },
			],
		});
		const after = makeDrawer({
			rooms: [
				{ id: "b", name: "B" },
				{ id: "a", name: "A" },
			],
		});
		expect(computeEvents(new Map([[before.id, before]]), [after])).toEqual([]);
	});

	it("emits user.assigned and user.unassigned on membership change", () => {
		const userA = { id: "u1", email: "a@x", meta: { firstName: "A", lastName: "X" } };
		const userB = { id: "u2", email: "b@x", meta: { firstName: "B", lastName: "X" } };
		const before = makeDrawer({ users: [userA] });
		const after = makeDrawer({ users: [userB] });
		const events = computeEvents(new Map([[before.id, before]]), [after]);
		expect(events).toEqual([
			{ kind: "user.assigned", drawer: after, user: userB },
			{ kind: "user.unassigned", drawer: after, user: userA },
		]);
	});

	it("emits one cash event per new ID in counts.payins[]", () => {
		const event1 = makeCashEvent("ev-1", { total: 100 });
		const event2 = makeCashEvent("ev-2", { total: 200 });
		const before = makeDrawer({ counts: makeCounts({ payins: [event1] }) });
		const after = makeDrawer({ counts: makeCounts({ payins: [event1, event2] }) });

		const events = computeEvents(new Map([[before.id, before]]), [after]);
		expect(events).toHaveLength(1);
		expect(events[0]).toEqual({ kind: "cash.payIn", drawer: after, event: event2 });
	});

	it("does NOT re-emit events already seen in the previous snapshot", () => {
		const event1 = makeCashEvent("ev-1");
		const event2 = makeCashEvent("ev-2");
		const snap1 = makeDrawer({ counts: makeCounts({ payins: [event1] }) });
		const snap2 = makeDrawer({ counts: makeCounts({ payins: [event1, event2] }) });
		const snap3 = makeDrawer({ counts: makeCounts({ payins: [event1, event2] }) });

		const e1 = computeEvents(new Map([[snap1.id, snap1]]), [snap2]);
		expect(e1.map((e) => (e.kind === "cash.payIn" ? e.event.id : null))).toEqual(["ev-2"]);

		const e2 = computeEvents(new Map([[snap2.id, snap2]]), [snap3]);
		expect(e2).toEqual([]);
	});

	it("emits cash events for all four arrays", () => {
		const newPayin = makeCashEvent("p1");
		const newPayout = makeCashEvent("o1");
		const newDrop = makeCashEvent("d1");
		const newPop = makeCashEvent("x1", { total: 0 });
		const before = makeDrawer({ counts: makeCounts() });
		const after = makeDrawer({
			counts: makeCounts({
				payins: [newPayin],
				payouts: [newPayout],
				drops: [newDrop],
				pops: [newPop],
			}),
		});
		const events = computeEvents(new Map([[before.id, before]]), [after]);
		const kinds = events.map((e) => e.kind);
		expect(kinds).toEqual(["cash.payIn", "cash.payOut", "cash.drop", "cash.pop"]);
	});

	it("combines multiple transitions on the same drawer in one diff", () => {
		const userA = { id: "u1", email: "a@x", meta: { firstName: "A", lastName: "X" } };
		const newPayin = makeCashEvent("p1");
		const before = makeDrawer({ openedAt: null, users: [], counts: null });
		const after = makeDrawer({
			openedAt: "2026-05-24T09:00:00Z",
			users: [userA],
			counts: makeCounts({ payins: [newPayin] }),
		});
		const events = computeEvents(new Map([[before.id, before]]), [after]);
		expect(events.map((e) => e.kind)).toEqual(["drawer.opened", "user.assigned", "cash.payIn"]);
	});

	it("survives a null counts object on either side", () => {
		const before = makeDrawer({ counts: null });
		const after = makeDrawer({ counts: null });
		expect(computeEvents(new Map([[before.id, before]]), [after])).toEqual([]);
	});
});

/* -------------------------------------------------------------------------
 * DrawerWatcher — end-to-end with a fake DrawerSource
 * ----------------------------------------------------------------------- */

function fakeSource(snapshots: Drawer[][]): DrawerSource & { calls: number } {
	let i = 0;
	const wrapper = {
		calls: 0,
		async list() {
			wrapper.calls++;
			const snap = snapshots[Math.min(i, snapshots.length - 1)];
			i++;
			return snap ?? [];
		},
	};
	return wrapper;
}

async function collect<T>(iter: AsyncIterable<T>, count: number): Promise<T[]> {
	const out: T[] = [];
	for await (const value of iter) {
		out.push(value);
		if (out.length >= count) break;
	}
	return out;
}

describe("DrawerWatcher", () => {
	it("emits nothing for the initial baseline; subsequent diffs emit events", async () => {
		const d0 = makeDrawer({ openedAt: null });
		const d1 = makeDrawer({ openedAt: "2026-05-24T09:00:00Z" });

		const source = fakeSource([[d0], [d1]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 0 });

		const events = await collect(watcher.events(), 1);
		expect(events.map((e) => e.kind)).toEqual(["drawer.opened"]);
		await watcher.stop();
	});

	it("emitInitial: true emits drawer.created for every initial drawer", async () => {
		const a = makeDrawer({ id: "a", name: "A" });
		const b = makeDrawer({ id: "b", name: "B" });

		const source = fakeSource([[a, b]]);
		const watcher = new DrawerWatcher({
			drawers: source,
			intervalMs: 0,
			emitInitial: true,
		});

		const events = await collect(watcher.events(), 2);
		expect(events.map((e) => (e.kind === "drawer.created" ? e.drawer.id : ""))).toEqual(["a", "b"]);
		await watcher.stop();
	});

	it("emits one cash.payIn per new event across polls", async () => {
		const e1 = makeCashEvent("e1");
		const e2 = makeCashEvent("e2");
		const e3 = makeCashEvent("e3");
		const snap1 = makeDrawer({ counts: makeCounts({ payins: [] }) });
		const snap2 = makeDrawer({ counts: makeCounts({ payins: [e1] }) });
		const snap3 = makeDrawer({ counts: makeCounts({ payins: [e1, e2] }) });
		const snap4 = makeDrawer({ counts: makeCounts({ payins: [e1, e2, e3] }) });

		const source = fakeSource([[snap1], [snap2], [snap3], [snap4]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 0 });

		const events = await collect(watcher.events(), 3);
		expect(events.map((e) => (e.kind === "cash.payIn" ? e.event.id : ""))).toEqual([
			"e1",
			"e2",
			"e3",
		]);
		await watcher.stop();
	});

	it("filters by drawerIds so other drawers' changes are ignored", async () => {
		const a0 = makeDrawer({ id: "a", openedAt: null });
		const a1 = makeDrawer({ id: "a", openedAt: "2026-05-24T09:00:00Z" });
		const b0 = makeDrawer({ id: "b", openedAt: null });
		const b1 = makeDrawer({ id: "b", openedAt: "2026-05-24T09:00:00Z" });

		const source = fakeSource([
			[a0, b0],
			[a1, b1],
		]);
		const watcher = new DrawerWatcher({
			drawers: source,
			intervalMs: 0,
			drawerIds: ["a"],
		});

		const events = await collect(watcher.events(), 1);
		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			kind: "drawer.opened",
			drawer: { id: "a" },
		});
		await watcher.stop();
	});

	it("stop() halts the iterator on the next pull", async () => {
		const snap = makeDrawer();
		const source = fakeSource([[snap], [snap], [snap]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 0 });

		const iter = watcher.events()[Symbol.asyncIterator]();
		await watcher.stop();
		const result = await iter.next();
		expect(result.done).toBe(true);
	});

	it("breaking out of for await calls stop() via iterator.return()", async () => {
		const d0 = makeDrawer({ openedAt: null });
		const d1 = makeDrawer({ openedAt: "2026-05-24T09:00:00Z" });
		const source = fakeSource([[d0], [d1], [d1]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 0 });

		let count = 0;
		for await (const _ of watcher.events()) {
			count++;
			break;
		}
		expect(count).toBe(1);

		// One more next() after a break should report done.
		const iter = watcher.events()[Symbol.asyncIterator]();
		const result = await iter.next();
		expect(result.done).toBe(true);
	});

	it("onError is invoked when the source throws; iteration continues", async () => {
		const d0 = makeDrawer({ openedAt: null });
		const d1 = makeDrawer({ openedAt: "2026-05-24T09:00:00Z" });

		const errors: Error[] = [];
		let i = 0;
		const source: DrawerSource = {
			async list() {
				i++;
				if (i === 2) throw new Error("transient");
				if (i === 1) return [d0];
				return [d1];
			},
		};
		const watcher = new DrawerWatcher({
			drawers: source,
			intervalMs: 0,
			onError: (err) => errors.push(err),
		});

		const events = await collect(watcher.events(), 1);
		expect(errors.map((e) => e.message)).toContain("transient");
		expect(events.map((e) => e.kind)).toEqual(["drawer.opened"]);
		await watcher.stop();
	});

	it("start() establishes the baseline before iteration; first iteration diffs from there", async () => {
		const d0 = makeDrawer({ openedAt: null });
		const d1 = makeDrawer({ openedAt: "2026-05-24T09:00:00Z" });
		const source = fakeSource([[d0], [d1]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 0 });

		await watcher.start();
		expect(source.calls).toBe(1);

		const events = await collect(watcher.events(), 1);
		expect(events.map((e) => e.kind)).toEqual(["drawer.opened"]);
		expect(source.calls).toBe(2);
		await watcher.stop();
	});

	it("start() is idempotent — calling twice still does one fetch", async () => {
		const d0 = makeDrawer();
		const source = fakeSource([[d0], [d0]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 0 });

		await watcher.start();
		await watcher.start();
		expect(source.calls).toBe(1);
		await watcher.stop();
	});

	it("respects intervalMs when > 0 by waiting between polls", async () => {
		const d0 = makeDrawer({ openedAt: null });
		const d1 = makeDrawer({ openedAt: "2026-05-24T09:00:00Z" });
		const source = fakeSource([[d0], [d1]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 30 });

		const t0 = Date.now();
		const events = await collect(watcher.events(), 1);
		const elapsed = Date.now() - t0;
		await watcher.stop();

		expect(events.map((e) => e.kind)).toEqual(["drawer.opened"]);
		expect(elapsed).toBeGreaterThanOrEqual(25);
	});

	it("stop() aborts an in-flight sleep so the iterator ends promptly", async () => {
		const d0 = makeDrawer();
		const source = fakeSource([[d0], [d0]]);
		const watcher = new DrawerWatcher({ drawers: source, intervalMs: 60_000 });

		const iter = watcher.events()[Symbol.asyncIterator]();
		await watcher.start(); // baseline established immediately
		const nextPromise = iter.next();
		// Stop while the generator is sleeping; the abort should resolve the sleep
		// and the loop should exit cleanly without waiting the full 60s.
		setTimeout(() => watcher.stop(), 10);
		const result = await nextPromise;
		expect(result.done).toBe(true);
	});

	it("typed switch on event.kind exhaustively narrows (compile-time check)", () => {
		const drawer = makeDrawer();
		const events: DrawerEvent[] = [
			{ kind: "drawer.created", drawer },
			{ kind: "drawer.deleted", drawerId: drawer.id },
			{ kind: "drawer.opened", drawer },
			{ kind: "drawer.closed", drawer },
			{ kind: "drawer.updated", drawer, previous: drawer },
		];
		const seen: string[] = [];
		for (const event of events) {
			switch (event.kind) {
				case "drawer.created":
				case "drawer.opened":
				case "drawer.closed":
				case "drawer.updated":
					seen.push(`${event.kind}:${event.drawer.id}`);
					break;
				case "drawer.deleted":
					seen.push(`${event.kind}:${event.drawerId}`);
					break;
				case "user.assigned":
				case "user.unassigned":
					seen.push(`${event.kind}:${event.user.id}`);
					break;
				case "cash.payIn":
				case "cash.payOut":
				case "cash.drop":
				case "cash.pop":
					seen.push(`${event.kind}:${event.event.id}`);
					break;
				default: {
					const _exhaustive: never = event;
					return _exhaustive;
				}
			}
		}
		expect(seen).toContain("drawer.opened:drawer-1");
	});
});
