/** Base URL for the Flowhub API */
export const DEFAULT_BASE_URL = "https://api.flowhub.co" as const;

/** Default request timeout in milliseconds */
export const DEFAULT_TIMEOUT_MS = 30_000 as const;

/** Default number of retries for failed requests */
export const DEFAULT_RETRIES = 3 as const;

/** Date of the docs snapshot used to generate types */
export const DOCS_SNAPSHOT_DATE = "2026-05-07" as const;
