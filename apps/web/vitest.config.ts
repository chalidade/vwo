import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Route tests: "@/..." as in Next, and "server-only" (which throws outside a React server build) as an empty module.
// Tests that use the database run against the test database, one file at a time.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    fileParallelism: false,
    testTimeout: 20000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test" },
  },
});
