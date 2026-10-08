import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL(".", import.meta.url)),
      // server-only throws outside a server bundle; tests import server modules directly.
      "server-only": fileURLToPath(new URL("./lib/test/empty.ts", import.meta.url)),
    },
  },
  test: {
    include: ["lib/**/*.test.ts"],
  },
});
