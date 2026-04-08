import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: [
        "scripts/lib/material-extractor.ts",
        "scripts/lib/curation.ts",
        "scripts/lib/product-classifier.ts",
        "src/lib/utils.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
