export interface FlowhubResponse<T> {
	readonly status: number;
	readonly data: readonly T[];
}
