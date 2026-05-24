import type {
	CashEvent,
	Drawer,
	DrawerEvent,
	DrawerSource,
	DrawerWatcherOptions,
} from "./cash-management-types.js";

const DEFAULT_INTERVAL_MS = 5000;

/**
 * Polls `DrawersResource.list()` on a fixed cadence, diffs each snapshot
 * against the previous one, and yields a stream of typed events as an
 * `AsyncIterable<DrawerEvent>`.
 *
 * Usage:
 * ```ts
 * const watcher = new DrawerWatcher({ drawers: client.drawers });
 * for await (const event of watcher.events()) {
 *   switch (event.kind) {
 *     case "cash.payIn": // ...
 *     case "drawer.opened": // ...
 *   }
 * }
 * ```
 *
 * The iterator yields one event at a time; polling waits for the consumer
 * to pull each event before producing more, so a slow handler back-pressures
 * the watcher rather than queuing events in memory.
 *
 * Stop the watcher by calling `stop()` or by `break`ing out of the
 * `for await` loop (the iterator's `return()` method calls `stop()`).
 *
 * The diff treats the very first snapshot as a baseline and emits nothing
 * for it by default. Pass `emitInitial: true` to emit `drawer.created` for
 * every drawer in the initial snapshot.
 */
export class DrawerWatcher {
	private readonly opts: DrawerWatcherOptions;
	private readonly intervalMs: number;
	private readonly filterIds: ReadonlySet<string> | null;
	private previous = new Map<string, Drawer>();
	private hasBaseline = false;
	private stopped = false;
	private sleepAbort: AbortController | undefined;

	constructor(opts: DrawerWatcherOptions) {
		this.opts = opts;
		this.intervalMs = opts.intervalMs ?? DEFAULT_INTERVAL_MS;
		this.filterIds = opts.drawerIds ? new Set(opts.drawerIds) : null;
	}

	/**
	 * Pre-fetch the baseline snapshot. Optional — if not called, the
	 * generator does it on first iteration. Useful when you want to align
	 * the baseline to a specific moment (e.g. right after a manual setup
	 * step) and then start iterating later.
	 */
	async start(): Promise<void> {
		if (this.hasBaseline) return;
		const drawers = await this.fetchFiltered();
		this.previous = new Map(drawers.map((d) => [d.id, d]));
		this.hasBaseline = true;
	}

	/**
	 * Halt polling. The active iterator will yield `done: true` on its
	 * next pull. Idempotent.
	 */
	async stop(): Promise<void> {
		this.stopped = true;
		this.sleepAbort?.abort();
	}

	events(): AsyncIterable<DrawerEvent> {
		const generator = this.run();
		const self = this;
		return {
			[Symbol.asyncIterator]() {
				return {
					next: () => generator.next(),
					return: async () => {
						await self.stop();
						return generator.return(undefined);
					},
					throw: (err) => generator.throw(err),
				};
			},
		};
	}

	private async *run(): AsyncGenerator<DrawerEvent> {
		if (!this.hasBaseline) {
			try {
				const drawers = await this.fetchFiltered();
				if (this.opts.emitInitial) {
					for (const d of drawers) {
						yield { kind: "drawer.created", drawer: d };
						if (this.stopped) return;
					}
				}
				this.previous = new Map(drawers.map((d) => [d.id, d]));
				this.hasBaseline = true;
			} catch (err) {
				this.opts.onError?.(err as Error);
			}
		}

		while (!this.stopped) {
			await this.sleep(this.intervalMs);
			if (this.stopped) return;
			try {
				const drawers = await this.fetchFiltered();
				const events = computeEvents(this.previous, drawers);
				this.previous = new Map(drawers.map((d) => [d.id, d]));
				for (const event of events) {
					yield event;
					if (this.stopped) return;
				}
			} catch (err) {
				this.opts.onError?.(err as Error);
			}
		}
	}

	private async fetchFiltered(): Promise<Drawer[]> {
		const drawers = await this.opts.drawers.list({ hidden: false });
		if (this.filterIds) {
			const f = this.filterIds;
			return drawers.filter((d) => f.has(d.id));
		}
		return drawers;
	}

	private async sleep(ms: number): Promise<void> {
		if (ms <= 0) return;
		const abort = new AbortController();
		this.sleepAbort = abort;
		try {
			await new Promise<void>((resolve) => {
				const timer = setTimeout(() => resolve(), ms);
				abort.signal.addEventListener("abort", () => {
					clearTimeout(timer);
					resolve();
				});
			});
		} finally {
			this.sleepAbort = undefined;
		}
	}
}

const CASH_FIELDS: ReadonlyArray<["payins" | "payouts" | "drops" | "pops", DrawerEvent["kind"]]> = [
	["payins", "cash.payIn"],
	["payouts", "cash.payOut"],
	["drops", "cash.drop"],
	["pops", "cash.pop"],
];

/**
 * Pure function — exported for unit testing. Diffs two drawer snapshots
 * (the previous keyed by id, the next as a list) and returns the events
 * that fire as a result of the transition.
 *
 * Event order within a single diff:
 *   1. drawer.deleted   (drawers gone from the new snapshot)
 *   2. drawer.created   (drawers new in the snapshot)
 *   3. Per-drawer in iteration order:
 *      a. drawer.updated  (name/type/dropTriggerBalance/rooms change)
 *      b. drawer.opened   (openedAt: null → set)
 *      c. drawer.closed   (closedAt: null → set)
 *      d. user.assigned / user.unassigned
 *      e. cash.* in array order (server returns them chronologically)
 */
export function computeEvents(prev: Map<string, Drawer>, nextList: Drawer[]): DrawerEvent[] {
	const events: DrawerEvent[] = [];
	const nextMap = new Map(nextList.map((d) => [d.id, d]));

	for (const [id] of prev) {
		if (!nextMap.has(id)) {
			events.push({ kind: "drawer.deleted", drawerId: id });
		}
	}

	for (const drawer of nextList) {
		const previous = prev.get(drawer.id);
		if (!previous) {
			events.push({ kind: "drawer.created", drawer });
			continue;
		}

		if (
			previous.name !== drawer.name ||
			previous.type !== drawer.type ||
			previous.dropTriggerBalance !== drawer.dropTriggerBalance ||
			!sameIdSet(previous.rooms, drawer.rooms)
		) {
			events.push({ kind: "drawer.updated", drawer, previous });
		}

		if (previous.openedAt == null && drawer.openedAt != null) {
			events.push({ kind: "drawer.opened", drawer });
		}
		if (previous.closedAt == null && drawer.closedAt != null) {
			events.push({ kind: "drawer.closed", drawer });
		}

		const prevUserIds = new Set(previous.users.map((u) => u.id));
		const nextUserIds = new Set(drawer.users.map((u) => u.id));
		for (const u of drawer.users) {
			if (!prevUserIds.has(u.id)) {
				events.push({ kind: "user.assigned", drawer, user: u });
			}
		}
		for (const u of previous.users) {
			if (!nextUserIds.has(u.id)) {
				events.push({ kind: "user.unassigned", drawer, user: u });
			}
		}

		for (const [field, kind] of CASH_FIELDS) {
			const prevIds = new Set((previous.counts?.[field] ?? []).map((e) => e.id));
			const nextEvents: ReadonlyArray<CashEvent> = drawer.counts?.[field] ?? [];
			for (const event of nextEvents) {
				if (!prevIds.has(event.id)) {
					events.push({ kind, drawer, event } as DrawerEvent);
				}
			}
		}
	}

	return events;
}

function sameIdSet(a: ReadonlyArray<{ id: string }>, b: ReadonlyArray<{ id: string }>): boolean {
	if (a.length !== b.length) return false;
	const setA = new Set(a.map((x) => x.id));
	for (const x of b) {
		if (!setA.has(x.id)) return false;
	}
	return true;
}
