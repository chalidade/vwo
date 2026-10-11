import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Route tests run the real handlers against the test database; only the session is stubbed.
export default defineConfig({
  resolve: {
    alias: {
      "@/": fileURLToPath(new URL("./", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: {
    fileParallelism: false,
    testTimeout: 20000,
    env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgres://vwo:vwo@localhost:5432/vwo_test" },
  },
});
