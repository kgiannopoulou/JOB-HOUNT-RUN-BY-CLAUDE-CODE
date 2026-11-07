import path from "node:path";

import { defineConfig } from "vitest/config";

const resolve = {
  alias: {
    "@": path.resolve(import.meta.dirname, "src"),
    "server-only": path.resolve(import.meta.dirname, "tests/stubs/server-only.ts"),
  },
};

export default defineConfig({
  test: {
    projects: [
      {
        resolve,
        test: {
          name: "unit",
          environment: "jsdom",
          include: ["tests/unit/**/*.test.{ts,tsx}"],
          setupFiles: ["tests/setup-unit.ts"],
        },
      },
      {
        resolve,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          setupFiles: ["tests/setup-integration.ts"],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 60_000,
        },
      },
      {
        resolve,
        test: {
          name: "live",
          environment: "node",
          include: ["tests/live/**/*.test.ts"],
          setupFiles: ["tests/setup-integration.ts"],
          fileParallelism: false,
          testTimeout: 180_000,
          hookTimeout: 60_000,
        },
      },
    ],
  },
});
