#!/usr/bin/env node
/*
 * Extract Flowhub GraphQL operations from a HAR file.
 *
 * Reads a HAR exported from Chrome DevTools, filters to POST requests
 * against api.flowhub.com under /graph, /analytics, or /billing, and
 * prints a JSON summary with operation names, variables, query strings,
 * and response bodies.
 *
 * Redacts:
 *   - the `password` variable on any operation
 *   - the entire `login` block in any response (which contains the
 *     dashboard session token + refresh token)
 *
 * Does NOT redact request/response headers, which are excluded from the
 * output entirely — the HAR's Authorization header value is not echoed.
 *
 * Usage:
 *   node scripts/extract-graphql-from-har.mjs <path-to.har>
 *   node scripts/extract-graphql-from-har.mjs <path-to.har> --out summary.json
 *   node scripts/extract-graphql-from-har.mjs <path-to.har> --op CreatePayIn
 *
 * Flags:
 *   --out <file>   Write JSON to file instead of stdout.
 *   --op <name>    Filter to a single operation name (repeatable).
 *   --no-query     Omit the verbose GraphQL query string (just keep
 *                  operationName + variables + response).
 */

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
	console.error(
		"Usage: node scripts/extract-graphql-from-har.mjs <file.har> [--out file.json] [--op Name]... [--no-query]",
	);
	process.exit(args.length === 0 ? 1 : 0);
}

const harPath = args[0];
const outPath = consumeFlag("--out");
const opFilters = consumeAllFlags("--op");
const omitQuery = args.includes("--no-query");

function consumeFlag(name) {
	const idx = args.indexOf(name);
	if (idx === -1) return null;
	const value = args[idx + 1];
	args.splice(idx, 2);
	return value;
}

function consumeAllFlags(name) {
	const collected = [];
	let idx;
	while ((idx = args.indexOf(name)) !== -1) {
		const value = args[idx + 1];
		if (value !== undefined) collected.push(value);
		args.splice(idx, value !== undefined ? 2 : 1);
	}
	return collected;
}

function redact(value) {
	if (value == null || typeof value !== "object") return value;
	if (Array.isArray(value)) return value.map(redact);
	const out = {};
	for (const [k, v] of Object.entries(value)) {
		if (k === "password") {
			out[k] = "<redacted>";
		} else if (k === "login" && v && typeof v === "object") {
			out[k] = "<login-response-redacted>";
		} else {
			out[k] = redact(v);
		}
	}
	return out;
}

function safeJsonParse(text) {
	if (text == null) return undefined;
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}

const har = JSON.parse(await readFile(harPath, "utf8"));
const entries = har.log?.entries ?? [];

const interesting = [];
for (const e of entries) {
	const url = e.request?.url ?? "";
	if (!/api\.flowhub\.com/.test(url)) continue;

	let urlPath;
	try {
		urlPath = new URL(url).pathname;
	} catch {
		continue;
	}
	if (!/^\/(graph|analytics|billing)/.test(urlPath)) continue;

	const reqBody = safeJsonParse(e.request?.postData?.text);
	const resBody = safeJsonParse(e.response?.content?.text);

	const operationName =
		reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) ? reqBody.operationName : undefined;

	if (opFilters.length > 0 && (!operationName || !opFilters.includes(operationName))) {
		continue;
	}

	const variables =
		reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) ? redact(reqBody.variables) : undefined;
	const query =
		!omitQuery && reqBody && typeof reqBody === "object" && !Array.isArray(reqBody) && typeof reqBody.query === "string"
			? reqBody.query.trim()
			: undefined;

	interesting.push({
		startedDateTime: e.startedDateTime,
		method: e.request?.method,
		path: urlPath,
		status: e.response?.status,
		operationName,
		variables,
		query,
		response: redact(resBody),
	});
}

const operationCounts = interesting.reduce((acc, e) => {
	const key = e.operationName ?? `${e.method} ${e.path}`;
	acc[key] = (acc[key] ?? 0) + 1;
	return acc;
}, {});

const summary = {
	source: path.basename(harPath),
	totalHarEntries: entries.length,
	flowhubGraphqlEntries: interesting.length,
	operationCounts,
	entries: interesting,
};

const output = `${JSON.stringify(summary, null, 2)}\n`;

if (outPath) {
	await writeFile(outPath, output);
	console.error(
		`Wrote ${interesting.length} Flowhub GraphQL entries (of ${entries.length} HAR entries) to ${outPath}`,
	);
} else {
	process.stdout.write(output);
}
