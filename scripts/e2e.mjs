// Runs Playwright against a production server on its own port. This replaces
// Playwright's webServer option, whose shutdown never finishes on Windows.
import { execSync, spawn } from "node:child_process";

import { startFakeAnthropic } from "../tests/e2e/fake-anthropic.mjs";

const port = 3100;
const anthropicPort = 3199;
const url = `http://localhost:${port}`;
const windows = process.platform === "win32";

// AI calls go to a local test double, so these tests are free and repeatable.
const fakeAnthropic = await startFakeAnthropic(anthropicPort);

// Started without a shell, so the process tree can be stopped reliably.
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    env: {
      ...process.env,
      SITE_URL: url,
      ANTHROPIC_API_KEY: "test-key-for-the-local-double",
      ANTHROPIC_BASE_URL: `http://127.0.0.1:${anthropicPort}`,
      AI_DAILY_LIMIT: "100",
    },
    stdio: "inherit",
    detached: !windows,
  },
);

function stopServer() {
  try {
    if (windows) {
      execSync(`taskkill /pid ${server.pid} /T /F`, { stdio: "ignore" });
    } else {
      process.kill(-server.pid, "SIGTERM");
    }
  } catch {
    // Already stopped.
  }
}

async function waitForServer() {
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      await fetch(url);
      return;
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }
  throw new Error(`Server did not start at ${url}`);
}

let status = 1;
try {
  await waitForServer();
  // Not spawnSync: that would block this process, which also serves the test double.
  const tests = spawn("npx", ["playwright", "test", ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: windows,
  });
  status = await new Promise((resolve) => tests.on("close", (code) => resolve(code ?? 1)));
} finally {
  stopServer();
  fakeAnthropic.close();
}
process.exit(status);
