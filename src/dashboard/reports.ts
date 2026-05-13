import { FlowhubAuthError } from "../errors.js";
import type { DashboardHttp } from "./http.js";
import type { SessionAuth } from "./session-auth.js";
import type { CommonReportParams, ReportDownload, ReportMetadata, ReportParams } from "./types.js";

const GET_REPORTS_QUERY = `
query GetReports {
  reports {
    reportId
    name
    description
    isCustom
    isFavorite
    reportTypeInfo {
      type
    }
    parameters {
      key
      type
      name
      description
      isHidden
      isRequired
      defaultValue
      options {
        option
        value
      }
    }
  }
}
`;

/**
 * Downloads CSV reports from the Flowhub dashboard's internal analytics endpoints.
 *
 * All reports are GET requests at /analytics/<reportId> with query params.
 * Responses are CSV bytes (mislabeled as text/plain by the server).
 *
 * Methods retry exactly once on 401 by invalidating the cached token and
 * re-logging in; if the retry also 401s, FlowhubAuthError propagates.
 */
export class ReportsResource {
	constructor(
		private readonly http: DashboardHttp,
		private readonly auth: SessionAuth,
		private readonly defaultStoreId: string | undefined,
	) {}

	/**
	 * List all reports available to the authenticated user, including custom
	 * and shared reports specific to their account. The returned `reportId`
	 * values can be passed to `downloadReport()`.
	 */
	async listReports(): Promise<ReportMetadata[]> {
		const token = await this.auth.getToken();
		const data = await this.http.graphql<{
			reports: Array<{
				reportId: string;
				name: string;
				description: string | null;
				isCustom: boolean;
				isFavorite: boolean;
				reportTypeInfo: { type: string };
				parameters: Array<{
					key: string;
					type: string;
					name: string | null;
					description: string | null;
					isHidden: boolean;
					isRequired: boolean;
					defaultValue: string | null;
					options: Array<{ option: string; value: string }> | null;
				}>;
			}>;
		}>(
			{
				operationName: "GetReports",
				variables: {},
				query: GET_REPORTS_QUERY,
			},
			token,
			"/analytics/query",
		);

		return data.reports.map((r) => ({
			reportId: r.reportId,
			name: r.name,
			description: r.description,
			type: r.reportTypeInfo.type,
			isCustom: r.isCustom,
			isFavorite: r.isFavorite,
			parameters: r.parameters.map((p) => ({
				key: p.key,
				type: p.type,
				name: p.name,
				description: p.description,
				isRequired: p.isRequired,
				isHidden: p.isHidden,
				defaultValue: p.defaultValue,
				options: p.options,
			})),
		}));
	}

	/**
	 * Download an arbitrary report by its ID.
	 *
	 * Use this for any of the ~60 report IDs Flowhub exposes (e.g. "accounting",
	 * "category-sales", "inventory-snapshot"). Custom report UUIDs work too.
	 */
	async downloadReport(reportId: string, params: ReportParams = {}): Promise<ReportDownload> {
		const merged: ReportParams = { ...params };
		if (this.defaultStoreId && merged.store_id === undefined) {
			merged.store_id = this.defaultStoreId;
		}

		const path = `/analytics/${reportId}`;
		const downloadOnce = async () => {
			const token = await this.auth.getToken();
			return this.http.downloadBinary(path, merged, token);
		};

		let result: Awaited<ReturnType<typeof downloadOnce>>;
		try {
			result = await downloadOnce();
		} catch (err) {
			if (err instanceof FlowhubAuthError) {
				this.auth.invalidate();
				result = await downloadOnce();
			} else {
				throw err;
			}
		}

		return {
			data: result.data,
			filename: result.filename ?? this.fallbackFilename(reportId, merged),
			contentType: result.contentType,
		};
	}

	/** Convenience: Accounting report (taxes, discounts, refunds, totals). */
	async downloadAccounting(params: CommonReportParams): Promise<ReportDownload> {
		return this.downloadReport("accounting", params);
	}

	/** Convenience: Sales by day by store. */
	async downloadSalesByDayStore(params: CommonReportParams): Promise<ReportDownload> {
		return this.downloadReport("sales-day-store", params);
	}

	/** Convenience: Category sales summary. */
	async downloadCategorySales(params: CommonReportParams): Promise<ReportDownload> {
		return this.downloadReport("category-sales", params);
	}

	/** Convenience: End-of-day report. */
	async downloadEndOfDay(params: CommonReportParams): Promise<ReportDownload> {
		return this.downloadReport("end-of-day", params);
	}

	/** Convenience: Transactions report. */
	async downloadTransactions(params: CommonReportParams): Promise<ReportDownload> {
		return this.downloadReport("transactions", params);
	}

	/** Convenience: Inventory snapshot (no date range required). */
	async downloadInventorySnapshot(
		params: { store_id?: string } & ReportParams = {},
	): Promise<ReportDownload> {
		return this.downloadReport("inventory-snapshot", params);
	}

	/** Convenience: Inventory levels. */
	async downloadInventoryLevels(
		params: { store_id?: string } & ReportParams = {},
	): Promise<ReportDownload> {
		return this.downloadReport("inventory-levels", params);
	}

	private fallbackFilename(reportId: string, params: ReportParams): string {
		const parts = [reportId];
		if (typeof params.start_date === "string") parts.push(String(params.start_date));
		if (typeof params.end_date === "string" && params.end_date !== params.start_date) {
			parts.push(String(params.end_date));
		}
		return `${parts.join("-")}.csv`;
	}
}
