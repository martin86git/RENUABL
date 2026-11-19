import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  // 20 seconds (19 Nov 2026): a proposal with the configurator prices every mix (sizes, panels, inverters, batteries,
  // storage steps, backup, charger), about a second each, and some tests publish several while every file runs at once.
  test: { include: ["src/**/*.test.ts"], testTimeout: 20_000 },
});
