import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    env: {
      HARNESS_SEARCH_PROVIDER: "none",
    },
  },
});
