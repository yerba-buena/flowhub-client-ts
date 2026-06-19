/**
 * Minimal, dependency-free CSV parser for the report download helpers.
 *
 * Flowhub's `/analytics/<reportId>` endpoints return CSV (mislabeled as
 * `text/plain`). This parser is RFC 4180-ish: it handles quoted fields,
 * embedded commas/newlines, and escaped quotes (`""`), plus both LF and CRLF
 * line endings. It is intentionally small — we don't pull in a CSV library to
 * keep the package zero-runtime-dependency.
 */

/** Parse CSV text into a header array and rows of raw string cells. */
export function parseCsvRaw(text: string): { columns: string[]; rows: string[][] } {
	const records: string[][] = [];
	let field = "";
	let record: string[] = [];
	let inQuotes = false;
	let started = false; // whether the current record has any content yet

	const pushField = () => {
		record.push(field);
		field = "";
	};
	const pushRecord = () => {
		pushField();
		records.push(record);
		record = [];
		started = false;
	};

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
			continue;
		}
		if (c === '"') {
			inQuotes = true;
			started = true;
		} else if (c === ",") {
			pushField();
			started = true;
		} else if (c === "\n") {
			pushRecord();
		} else if (c === "\r") {
			// swallow; the following \n (if any) triggers the record
			if (text[i + 1] !== "\n") pushRecord();
		} else {
			field += c;
			started = true;
		}
	}
	// flush trailing field/record if the file didn't end with a newline
	if (started || field !== "" || record.length > 0) pushRecord();

	const columns = records.shift() ?? [];
	return { columns, rows: records };
}

/**
 * Parse CSV text into a header array and an array of row objects keyed by
 * column name. Cells beyond the header length are dropped; missing trailing
 * cells become empty strings.
 */
export function parseCsv(text: string): {
	columns: string[];
	rows: Array<Record<string, string>>;
} {
	const { columns, rows } = parseCsvRaw(text);
	const objects = rows.map((cells) => {
		const obj: Record<string, string> = {};
		for (let i = 0; i < columns.length; i++) {
			obj[columns[i] as string] = cells[i] ?? "";
		}
		return obj;
	});
	return { columns, rows: objects };
}
