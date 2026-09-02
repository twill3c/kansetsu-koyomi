import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests-js/**/*.test.ts"],
    environment: "node",
  },
  resolve: { alias: { "@": new URL(".", import.meta.url).pathname } },
});
