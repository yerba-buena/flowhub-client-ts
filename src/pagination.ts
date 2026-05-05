export interface FlowhubResponse<T> {
	readonly status: number;
	readonly data: readonly T[];
}

/**
 * Pagination query parameters.
 *
 * NOTE: The Flowhub OpenAPI spec does not document pagination parameters on
 * inventory or locations endpoints (all declare `parameters: []`). The spec
 * defines orphaned `page`/`page_size` traits that no endpoint references.
 * These `limit`/`offset` params are sent optimistically — the server may
 * ignore them and return the full dataset. The `paginate()` helper handles
 * this gracefully by stopping when a page returns fewer items than requested.
 */
export interface PaginationParams {
	readonly limit?: number | undefined;
	readonly offset?: number | undefined;
}

export function buildPaginationQuery(
	params?: PaginationParams,
): Record<string, string | number | boolean | undefined> {
	if (!params) return {};

	const query: Record<string, string | number | boolean | undefined> = {};
	if (params.limit !== undefined) query.limit = params.limit;
	if (params.offset !== undefined) query.offset = params.offset;
	return query;
}

export async function* paginate<T, P extends PaginationParams>(
	fetcher: (params: P) => Promise<FlowhubResponse<T>>,
	params: P,
	pageSize = 50,
): AsyncGenerator<T, void, undefined> {
	let offset = params.offset ?? 0;

	while (true) {
		const response = await fetcher({ ...params, limit: pageSize, offset } as P);

		for (const item of response.data) {
			yield item;
		}

		if (response.data.length < pageSize) break;
		offset += response.data.length;
	}
}
