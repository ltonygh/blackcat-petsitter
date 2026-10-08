import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Only run the database/tenant tests here.
    include: ["db/**/*.test.ts"],
    // These tests hit a real database; run them serially and allow time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    environment: "node",
  },
});
