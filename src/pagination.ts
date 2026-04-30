export interface FlowhubResponse<T> {
	readonly status: number;
	readonly data: readonly T[];
}

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
