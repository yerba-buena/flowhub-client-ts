import { defineConfig } from "tsup";

export default defineConfig({
	entry: { index: "src/index.ts", "dashboard/index": "src/dashboard/index.ts" },
	format: ["esm", "cjs"],
	dts: true,
	splitting: false,
	sourcemap: true,
	clean: true,
	target: "es2022",
	outDir: "dist",
});
