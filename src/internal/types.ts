export interface FlowhubInternalCredentials {
	readonly email: string;
	readonly password: string;
}

export interface InternalLoginResponse {
	readonly id: string;
	readonly refreshId: string;
	readonly expireTime: number;
}

export interface ReportDownload {
	readonly data: Buffer;
	readonly filename: string;
	readonly contentType: string;
}

export type ReportParams = Record<string, string | number | boolean | undefined>;

export type DateRangeParams = ReportParams & {
	readonly start_date: string;
	readonly end_date: string;
};

export type CommonReportParams = DateRangeParams & {
	readonly store_id?: string;
};

export interface ReportParameterOption {
	readonly option: string;
	readonly value: string;
}

export interface ReportParameterMetadata {
	readonly key: string;
	readonly type: string;
	readonly name: string | null;
	readonly description: string | null;
	readonly isRequired: boolean;
	readonly isHidden: boolean;
	readonly defaultValue: string | null;
	readonly options: ReadonlyArray<ReportParameterOption> | null;
}

export interface ReportMetadata {
	readonly reportId: string;
	readonly name: string;
	readonly description: string | null;
	readonly type: string;
	readonly isCustom: boolean;
	readonly isFavorite: boolean;
	readonly parameters: ReadonlyArray<ReportParameterMetadata>;
}
