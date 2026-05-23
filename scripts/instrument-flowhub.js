/*
 * Flowhub dashboard network instrumentation
 *
 * Paste this entire file into the Console panel of DevTools while the
 * Flowhub dashboard tab (app.flowhub.com) is open. It wraps window.fetch
 * to intercept calls to api.flowhub.com and logs each GraphQL operation
 * (operation name, variables, response) as it fires, while also keeping
 * a structured in-memory log you can dump to a JSON file.
 *
 * Companion to docs/cash-management-discovery.md.
 *
 * Safe operations exposed on window.__flowhubInstrument:
 *   .summary()  — prints a console.table of operation counts so you can
 *                 sanity-check that each user action produced at least
 *                 one captured request.
 *   .dump()     — downloads a redacted JSON file with every captured
 *                 Flowhub request. Redacts the `password` variable and
 *                 the `login` response block (which contains tokens).
 *                 Does NOT include request headers, so the access token
 *                 is never written to the dump file.
 *   .reset()    — clears the in-memory log without uninstalling.
 *
 * Idempotent: re-pasting the snippet detects an existing install and
 * exits with a warning instead of double-wrapping fetch.
 */

(() => {
	if (window.__flowhubInstrument) {
		console.warn(
			"[flowhub-instrument] already installed. Use window.__flowhubInstrument.reset() to clear the log.",
		);
		return;
	}

	const FLOWHUB_HOST_RE = /(^|\/\/)api\.flowhub\.com(\/|$)/;
	const GRAPHQL_PATH_RE = /\/(graph|analytics|billing)\/query(\?|$|\/)/;

	const log = [];
	const startTs = Date.now();
	const origFetch = window.fetch.bind(window);

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

	async function extractBody(input, init) {
		if (init && typeof init.body === "string") return init.body;
		if (init && init.body instanceof URLSearchParams) return init.body.toString();
		if (input instanceof Request) {
			try {
				return await input.clone().text();
			} catch {
				return undefined;
			}
		}
		return undefined;
	}

	window.fetch = async (input, init) => {
		const url = input instanceof Request ? input.url : typeof input === "string" ? input : String(input);
		const method = (
			(init && init.method) ||
			(input instanceof Request ? input.method : "GET") ||
			"GET"
		).toUpperCase();

		const isFlowhub = FLOWHUB_HOST_RE.test(url);
		const isGraph = isFlowhub && GRAPHQL_PATH_RE.test(url);

		let parsedBody;
		if (isGraph) {
			const bodyText = await extractBody(input, init);
			if (typeof bodyText === "string") {
				try {
					parsedBody = JSON.parse(bodyText);
				} catch {
					parsedBody = bodyText;
				}
			}
		}

		const start = performance.now();
		let res;
		try {
			res = await origFetch(input, init);
		} catch (err) {
			if (isFlowhub) {
				log.push({
					ts: Date.now() - startTs,
					path: url.replace(/^https?:\/\/[^/]+/, ""),
					method,
					error: String(err),
					operationName: parsedBody && parsedBody.operationName,
				});
			}
			throw err;
		}

		if (!isFlowhub) return res;

		let resBody;
		try {
			resBody = await res.clone().json();
		} catch {
			resBody = "<non-json>";
		}

		const entry = {
			ts: Date.now() - startTs,
			path: url.replace(/^https?:\/\/[^/]+/, ""),
			method,
			status: res.status,
			durationMs: Math.round(performance.now() - start),
			operationName: parsedBody && parsedBody.operationName,
			variables: redact(parsedBody && parsedBody.variables),
			query: parsedBody && typeof parsedBody.query === "string" ? parsedBody.query.trim() : undefined,
			response: redact(resBody),
		};
		log.push(entry);

		if (entry.operationName) {
			console.groupCollapsed(
				`[flowhub] ${entry.operationName} → ${entry.status} (${entry.durationMs}ms)`,
			);
			console.log("variables:", entry.variables);
			console.log("response:", entry.response);
			console.groupEnd();
		} else if (isGraph) {
			console.log(`[flowhub] ${method} ${entry.path} → ${entry.status}`);
		}

		return res;
	};

	window.__flowhubInstrument = {
		log,
		summary() {
			const counts = {};
			for (const e of log) {
				const k = e.operationName || `${e.method} ${e.path}`;
				counts[k] = (counts[k] || 0) + 1;
			}
			console.table(counts);
			console.log(`[flowhub-instrument] ${log.length} total entries`);
		},
		dump(filename) {
			const payload = {
				capturedAt: new Date().toISOString(),
				origin: location.origin,
				totalEntries: log.length,
				entries: log,
			};
			const json = JSON.stringify(payload, null, 2);
			const blob = new Blob([json], { type: "application/json" });
			const url = URL.createObjectURL(blob);
			const a = document.createElement("a");
			a.href = url;
			a.download = filename || `flowhub-instrument-${Date.now()}.json`;
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			URL.revokeObjectURL(url);
			console.log(`[flowhub-instrument] dumped ${log.length} entries to ${a.download}`);
		},
		reset() {
			log.length = 0;
			console.log("[flowhub-instrument] log cleared");
		},
	};

	console.log(
		"[flowhub-instrument] installed. Perform actions, then call:\n" +
			"  window.__flowhubInstrument.summary()  // operation counts\n" +
			"  window.__flowhubInstrument.dump()     // download captured ops as JSON",
	);
})();
