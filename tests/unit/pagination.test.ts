import { describe, expect, it, vi } from "vitest";
import {
	type FlowhubResponse,
	type PaginationParams,
	buildPaginationQuery,
	paginate,
} from "../../src/pagination.js";

describe("buildPaginationQuery", () => {
	it("returns empty object for no params", () => {
		expect(buildPaginationQuery()).toEqual({});
	});

	it("returns empty object for empty params", () => {
		expect(buildPaginationQuery({})).toEqual({});
	});

	it("includes limit when set", () => {
		expect(buildPaginationQuery({ limit: 25 })).toEqual({ limit: 25 });
	});

	it("includes offset when set", () => {
		expect(buildPaginationQuery({ offset: 100 })).toEqual({ offset: 100 });
	});

	it("includes both limit and offset", () => {
		expect(buildPaginationQuery({ limit: 10, offset: 20 })).toEqual({
			limit: 10,
			offset: 20,
		});
	});
});

describe("paginate", () => {
	type Item = { id: number };

	it("yields all items from a single page", async () => {
		const fetcher = vi
			.fn<(params: PaginationParams) => Promise<FlowhubResponse<Item>>>()
			.mockResolvedValueOnce({
				status: 200,
				data: [{ id: 1 }, { id: 2 }],
			});

		const items: Item[] = [];
		for await (const item of paginate<Item, PaginationParams>(fetcher, {}, 50)) {
			items.push(item);
		}

		expect(items).toEqual([{ id: 1 }, { id: 2 }]);
		expect(fetcher).toHaveBeenCalledTimes(1);
	});

	it("yields items across multiple pages", async () => {
		const fetcher = vi
			.fn<(params: PaginationParams) => Promise<FlowhubResponse<Item>>>()
			.mockResolvedValueOnce({ status: 200, data: [{ id: 1 }, { id: 2 }] })
			.mockResolvedValueOnce({ status: 200, data: [{ id: 3 }] });

		const items: Item[] = [];
		for await (const item of paginate<Item, PaginationParams>(fetcher, {}, 2)) {
			items.push(item);
		}

		expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});

	it("stops when empty page returned", async () => {
		const fetcher = vi
			.fn<(params: PaginationParams) => Promise<FlowhubResponse<Item>>>()
			.mockResolvedValueOnce({ status: 200, data: [{ id: 1 }] })
			.mockResolvedValueOnce({ status: 200, data: [] });

		const items: Item[] = [];
		for await (const item of paginate<Item, PaginationParams>(fetcher, {}, 1)) {
			items.push(item);
		}

		expect(items).toEqual([{ id: 1 }]);
		expect(fetcher).toHaveBeenCalledTimes(2);
	});
});
