import { randomUUID } from "node:crypto";

import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { syncProvider } from "@/server/jobs/sync";
import {
  ProviderError,
  type JobProvider,
  type NormalizedJob,
} from "@/server/jobs/types";

import { adminClient } from "./helpers";

const hour = 60 * 60 * 1000;
const admin = adminClient();

let providerId: string;
const used: string[] = [];

function job(overrides: Partial<NormalizedJob> = {}): NormalizedJob {
  const id = randomUUID();
  return {
    provider: providerId,
    providerJobId: id,
    fingerprint: id,
    title: "Data Analyst",
    company: "Sync Company",
    description: "Plain text.",
    sourceUrl: `https://example.com/jobs/${id}`,
    locationRaw: "Worldwide",
    locations: ["Worldwide"],
    city: null,
    remotePolicy: "remote",
    employmentType: "full_time",
    experienceLevel: "unknown",
    category: "Data",
    tags: ["sql"],
    salaryText: "$50k",
    salaryMin: 50000,
    salaryMax: 50000,
    salaryCurrency: "USD",
    salaryAnnualMin: 50000,
    salaryAnnualMax: 50000,
    postedAt: "2026-11-01T00:00:00.000Z",
    ...overrides,
  };
}

function provider(fetchJobs: JobProvider["fetchJobs"]): JobProvider {
  return { id: providerId, name: "Test", minSyncIntervalMs: 6 * hour, fetchJobs };
}

const returning = (...jobs: NormalizedJob[]) =>
  vi.fn(async () => ({ jobs, skipped: 0 }));

const storedJobs = async () => {
  const { data } = await admin.from("jobs").select("*").eq("provider", providerId);
  return data ?? [];
};

beforeEach(() => {
  providerId = `test-sync-${randomUUID()}`;
  used.push(providerId);
});

afterAll(async () => {
  await admin.from("jobs").delete().in("provider", used);
  await admin.from("job_sync_runs").delete().in("provider", used);
});

describe("syncProvider", () => {
  it("stores normalised jobs with their source details", async () => {
    const listing = job();
    const result = await syncProvider(admin, provider(returning(listing)));

    expect(result).toMatchObject({ status: "succeeded", fetched: 1, inserted: 1 });
    const [row] = await storedJobs();
    expect(row).toMatchObject({
      provider: providerId,
      source_url: listing.sourceUrl,
      title: "Data Analyst",
    });
    expect(new Date(row.posted_at!).toISOString()).toBe(listing.postedAt);
  });

  it("does not call the provider again within its allowed interval", async () => {
    const fetchJobs = returning(job());
    const now = new Date();
    await syncProvider(admin, provider(fetchJobs), now);

    const later = new Date(now.getTime() + 5 * hour);
    const result = await syncProvider(admin, provider(fetchJobs), later);

    expect(result.status).toBe("skipped");
    expect(fetchJobs).toHaveBeenCalledTimes(1);
  });

  it("calls the provider again once the interval has passed", async () => {
    const fetchJobs = returning(job());
    const now = new Date();
    await syncProvider(admin, provider(fetchJobs), now);
    await syncProvider(admin, provider(fetchJobs), new Date(now.getTime() + 7 * hour));
    expect(fetchJobs).toHaveBeenCalledTimes(2);
  });

  it("counts a failed attempt, so errors cannot hammer the provider", async () => {
    const fetchJobs = vi.fn(async () => {
      throw new ProviderError("rate_limited", "Slow down");
    });
    const now = new Date();

    const first = await syncProvider(admin, provider(fetchJobs), now);
    expect(first).toMatchObject({ status: "failed", error: "Slow down" });

    const second = await syncProvider(
      admin,
      provider(fetchJobs),
      new Date(now.getTime() + hour),
    );
    expect(second.status).toBe("skipped");
    expect(fetchJobs).toHaveBeenCalledTimes(1);
  });

  it("records each run", async () => {
    await syncProvider(admin, provider(returning(job(), job())));
    const { data } = await admin
      .from("job_sync_runs")
      .select("*")
      .eq("provider", providerId);
    expect(data).toHaveLength(1);
    expect(data![0]).toMatchObject({
      status: "succeeded",
      fetched_count: 2,
      inserted_count: 2,
    });
    expect(data![0].finished_at).not.toBeNull();
  });

  it("allows only one sync at a time", async () => {
    let release = () => {};
    const blocked = new Promise<void>((resolve) => (release = resolve));
    const slow = vi.fn(async () => {
      await blocked;
      return { jobs: [], skipped: 0 };
    });

    const first = syncProvider(admin, provider(slow));
    await vi.waitFor(() => expect(slow).toHaveBeenCalled());

    const second = await syncProvider(admin, provider(slow));
    expect(second.status).toBe("skipped");

    release();
    expect((await first).status).toBe("succeeded");
    expect(slow).toHaveBeenCalledTimes(1);
  });

  it("recovers from a run that crashed", async () => {
    const started = new Date(Date.now() - 7 * hour);
    await admin
      .from("job_sync_runs")
      .insert({ provider: providerId, started_at: started.toISOString() });

    const result = await syncProvider(admin, provider(returning(job())));
    expect(result.status).toBe("succeeded");
  });
});

describe("duplicates", () => {
  it("updates a job instead of adding it again", async () => {
    const listing = job();
    const now = new Date();
    await syncProvider(admin, provider(returning(listing)), now);

    const result = await syncProvider(
      admin,
      provider(returning({ ...listing, title: "Lead Data Analyst" })),
      new Date(now.getTime() + 7 * hour),
    );

    expect(result).toMatchObject({ inserted: 0, updated: 1 });
    const rows = await storedJobs();
    expect(rows).toHaveLength(1);
    expect(rows[0].title).toBe("Lead Data Analyst");
  });

  it("keeps one row when a fetch lists a job twice", async () => {
    const fingerprint = randomUUID();
    const result = await syncProvider(
      admin,
      provider(returning(job({ fingerprint }), job({ fingerprint }))),
    );
    expect(result).toMatchObject({ inserted: 1, duplicates: 1 });
    expect(await storedJobs()).toHaveLength(1);
  });

  it("keeps one row when two providers list the same job", async () => {
    const fingerprint = randomUUID();
    await syncProvider(admin, provider(returning(job({ fingerprint }))));

    const firstProvider = providerId;
    providerId = `test-sync-${randomUUID()}`;
    used.push(providerId);

    const result = await syncProvider(
      admin,
      provider(returning(job({ fingerprint }))),
    );

    expect(result).toMatchObject({ inserted: 0, duplicates: 1 });
    expect(await storedJobs()).toHaveLength(0);
    const { data } = await admin
      .from("jobs")
      .select("provider")
      .eq("fingerprint", fingerprint);
    expect(data).toEqual([{ provider: firstProvider }]);
  });
});

describe("expiry", () => {
  it("retires jobs not seen for two weeks", async () => {
    const listing = job();
    const now = new Date();
    await syncProvider(admin, provider(returning(listing)), now);

    const later = new Date(now.getTime() + 15 * 24 * hour);
    await syncProvider(admin, provider(returning()), later);

    const [row] = await storedJobs();
    expect(row.is_active).toBe(false);
  });

  it("keeps jobs when the provider is down", async () => {
    const now = new Date();
    await syncProvider(admin, provider(returning(job())), now);

    const failing = vi.fn(async () => {
      throw new ProviderError("unavailable", "Down");
    });
    await syncProvider(
      admin,
      provider(failing),
      new Date(now.getTime() + 15 * 24 * hour),
    );

    const [row] = await storedJobs();
    expect(row.is_active).toBe(true);
  });
});
