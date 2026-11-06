import { defineConfig } from "@playwright/test";

// Run with `npm run test:e2e`, which starts the server on this port.
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  globalTimeout: 300_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3100",
    trace: "retain-on-failure",
    channel: process.env.CI ? undefined : "chrome",
  },
});
