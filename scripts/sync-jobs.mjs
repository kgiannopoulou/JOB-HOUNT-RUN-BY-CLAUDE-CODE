// Runs the job sync against the local app: start it first with `npm run dev`.
// The app enforces each provider's request limit, so extra runs are skipped safely.
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });

const baseUrl = process.env.SITE_URL ?? "http://localhost:3000";
const response = await fetch(`${baseUrl}/api/internal/cron/sync-jobs`, {
  headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
});

console.log(response.status, JSON.stringify(await response.json(), null, 2));
process.exitCode = response.ok ? 0 : 1;
