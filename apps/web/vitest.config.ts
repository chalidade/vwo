import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Route tests: "@/..." as in Next, and "server-only" (which throws outside a React server build) as an empty module.
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
  test: { include: ["test/**/*.test.ts"] },
});
