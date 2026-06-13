import { defineConfig } from "tsup";

export default defineConfig({
	entry: {
		index: "src/index.ts",
		"internal/index": "src/internal/index.ts",
		// Deprecated alias entry point — re-exports ./internal under the old names.
		"dashboard/index": "src/dashboard/index.ts",
	},
	format: ["esm", "cjs"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	target: "es2022",
	outDir: "dist",
});
