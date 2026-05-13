export interface FlowhubDashboardCredentials {
	readonly email: string;
	readonly password: string;
}

export interface DashboardLoginResponse {
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
