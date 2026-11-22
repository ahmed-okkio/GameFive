import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, ".")
    }
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // DB test files share one local database and truncate it.
    fileParallelism: false,
    // The first query against a cold local database can take several seconds.
    testTimeout: 20_000
  }
});
