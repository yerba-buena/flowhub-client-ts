import { describe, expect, it } from "vitest";
import { parseCsv, parseCsvRaw } from "../../src/internal/csv.js";

describe("parseCsv", () => {
	it("parses a simple table into row objects", () => {
		const { columns, rows } = parseCsv("a,b,c\n1,2,3\n4,5,6\n");
		expect(columns).toEqual(["a", "b", "c"]);
		expect(rows).toEqual([
			{ a: "1", b: "2", c: "3" },
			{ a: "4", b: "5", c: "6" },
		]);
	});

	it("handles quoted fields with commas, quotes, and newlines", () => {
		const text = 'name,note\n"Doe, Jane","said ""hi"""\n"multi\nline","ok"\n';
		const { rows } = parseCsv(text);
		expect(rows[0]).toEqual({ name: "Doe, Jane", note: 'said "hi"' });
		expect(rows[1]).toEqual({ name: "multi\nline", note: "ok" });
	});

	it("handles CRLF line endings and a missing trailing newline", () => {
		const { columns, rows } = parseCsv("x,y\r\n1,2\r\n3,4");
		expect(columns).toEqual(["x", "y"]);
		expect(rows).toEqual([
			{ x: "1", y: "2" },
			{ x: "3", y: "4" },
		]);
	});

	it("fills missing trailing cells with empty strings", () => {
		const { rows } = parseCsv("a,b,c\n1,2\n");
		expect(rows[0]).toEqual({ a: "1", b: "2", c: "" });
	});

	it("preserves currency/percent strings verbatim (no coercion)", () => {
		const { rows } = parseCsv('budtender,aov,loyalty_pct\nMark M,"$12.00","41.5%"\n');
		expect(rows[0]).toEqual({ budtender: "Mark M", aov: "$12.00", loyalty_pct: "41.5%" });
	});

	it("parseCsvRaw returns columns + raw cell arrays", () => {
		const { columns, rows } = parseCsvRaw("a,b\n1,2\n");
		expect(columns).toEqual(["a", "b"]);
		expect(rows).toEqual([["1", "2"]]);
	});

	it("returns empty columns/rows for empty input", () => {
		expect(parseCsv("")).toEqual({ columns: [], rows: [] });
	});
});
