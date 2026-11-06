// Runs Playwright against a production server on its own port. This replaces
// Playwright's webServer option, whose shutdown never finishes on Windows.
import { execSync, spawn, spawnSync } from "node:child_process";

const port = 3100;
const url = `http://localhost:${port}`;
const windows = process.platform === "win32";

// Started without a shell, so the process tree can be stopped reliably.
const server = spawn(
  process.execPath,
  ["node_modules/next/dist/bin/next", "start", "-p", String(port)],
  {
    env: { ...process.env, SITE_URL: url },
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
  const result = spawnSync("npx", ["playwright", "test", ...process.argv.slice(2)], {
    stdio: "inherit",
    shell: windows,
  });
  status = result.status ?? 1;
} finally {
  stopServer();
}
process.exit(status);
