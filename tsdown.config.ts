import { defineConfig } from "tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/kinds/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
});
