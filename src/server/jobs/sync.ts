import type { SupabaseClient } from "@supabase/supabase-js";

import { planUpsert, type ExistingJob } from "@/server/jobs/dedupe";
import {
  ProviderError,
  type JobProvider,
  type NormalizedJob,
} from "@/server/jobs/types";
import type { Database } from "@/types/database";

type Admin = SupabaseClient<Database>;

export type SyncResult =
  | { status: "skipped"; provider: string; reason: string }
  | { status: "failed"; provider: string; error: string }
  | {
      status: "succeeded";
      provider: string;
      fetched: number;
      inserted: number;
      updated: number;
      duplicates: number;
      skipped: number;
    };

const staleRunMs = 15 * 60 * 1000;
const inactiveAfterMs = 14 * 24 * 60 * 60 * 1000;

function toRow(job: NormalizedJob, seenAt: string) {
  return {
    provider: job.provider,
    provider_job_id: job.providerJobId,
    fingerprint: job.fingerprint,
    title: job.title,
    company: job.company,
    description: job.description,
    source_url: job.sourceUrl,
    location_raw: job.locationRaw,
    locations: job.locations,
    city: job.city,
    remote_policy: job.remotePolicy,
    employment_type: job.employmentType,
    experience_level: job.experienceLevel,
    category: job.category,
    tags: job.tags,
    salary_text: job.salaryText,
    salary_min: job.salaryMin,
    salary_max: job.salaryMax,
    salary_currency: job.salaryCurrency,
    salary_annual_min: job.salaryAnnualMin,
    salary_annual_max: job.salaryAnnualMax,
    posted_at: job.postedAt,
    last_seen_at: seenAt,
    is_active: true,
  };
}

async function loadExisting(admin: Admin, jobs: NormalizedJob[]) {
  const columns = "id, provider, provider_job_id, fingerprint";
  const provider = jobs[0].provider;
  const [byId, byFingerprint] = await Promise.all([
    admin
      .from("jobs")
      .select(columns)
      .eq("provider", provider)
      .in("provider_job_id", jobs.map((job) => job.providerJobId)),
    admin
      .from("jobs")
      .select(columns)
      .in("fingerprint", jobs.map((job) => job.fingerprint)),
  ]);
  if (byId.error) throw new Error(byId.error.message);
  if (byFingerprint.error) throw new Error(byFingerprint.error.message);

  const rows = new Map<string, ExistingJob>();
  for (const row of [...byId.data, ...byFingerprint.data]) rows.set(row.id, row);
  return [...rows.values()];
}

async function storeJobs(admin: Admin, jobs: NormalizedJob[], seenAt: string) {
  if (jobs.length === 0) return { inserted: 0, updated: 0, duplicates: 0 };

  const plan = planUpsert(jobs, await loadExisting(admin, jobs));

  if (plan.inserts.length > 0) {
    const { error } = await admin
      .from("jobs")
      .insert(plan.inserts.map((job) => toRow(job, seenAt)));
    if (error) throw new Error(error.message);
  }

  for (const { id, job } of plan.updates) {
    const { error } = await admin
      .from("jobs")
      .update(toRow(job, seenAt))
      .eq("id", id);
    if (error) throw new Error(error.message);
  }

  if (plan.seenIds.length > 0) {
    const { error } = await admin
      .from("jobs")
      .update({ last_seen_at: seenAt, is_active: true })
      .in("id", plan.seenIds);
    if (error) throw new Error(error.message);
  }

  return {
    inserted: plan.inserts.length,
    updated: plan.updates.length,
    duplicates: plan.duplicates,
  };
}

/**
 * Fetches one provider into the jobs table, at most once per its allowed
 * interval. Every attempt counts, including failures, so a broken sync cannot
 * keep hitting the provider.
 */
export async function syncProvider(
  admin: Admin,
  provider: JobProvider,
  now = new Date(),
): Promise<SyncResult> {
  const skip = (reason: string): SyncResult => ({
    status: "skipped",
    provider: provider.id,
    reason,
  });

  await admin
    .from("job_sync_runs")
    .update({
      status: "failed",
      error: "Timed out",
      finished_at: now.toISOString(),
    })
    .eq("provider", provider.id)
    .eq("status", "running")
    .lt("started_at", new Date(now.getTime() - staleRunMs).toISOString());

  const { data: lastRun, error: lastRunError } = await admin
    .from("job_sync_runs")
    .select("started_at")
    .eq("provider", provider.id)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (lastRunError) throw new Error(lastRunError.message);

  if (lastRun) {
    const nextAllowed =
      new Date(lastRun.started_at).getTime() + provider.minSyncIntervalMs;
    if (now.getTime() < nextAllowed) {
      return skip(`Next sync allowed at ${new Date(nextAllowed).toISOString()}`);
    }
  }

  const { data: run, error: runError } = await admin
    .from("job_sync_runs")
    .insert({ provider: provider.id, started_at: now.toISOString() })
    .select("id")
    .single();
  if (runError?.code === "23505") return skip("A sync is already running");
  if (runError) throw new Error(runError.message);

  const finish = (fields: Database["public"]["Tables"]["job_sync_runs"]["Update"]) =>
    admin
      .from("job_sync_runs")
      .update({ ...fields, finished_at: new Date().toISOString() })
      .eq("id", run.id);

  try {
    const { jobs, skipped } = await provider.fetchJobs();
    const seenAt = now.toISOString();
    const stored = await storeJobs(admin, jobs, seenAt);

    // Only after a successful fetch, so an outage never hides every job.
    await admin
      .from("jobs")
      .update({ is_active: false })
      .eq("provider", provider.id)
      .eq("is_active", true)
      .lt(
        "last_seen_at",
        new Date(now.getTime() - inactiveAfterMs).toISOString(),
      );

    await finish({
      status: "succeeded",
      fetched_count: jobs.length,
      inserted_count: stored.inserted,
      updated_count: stored.updated,
      duplicate_count: stored.duplicates,
      skipped_count: skipped,
    });

    return {
      status: "succeeded",
      provider: provider.id,
      fetched: jobs.length,
      skipped,
      ...stored,
    };
  } catch (error) {
    const message =
      error instanceof ProviderError || error instanceof Error
        ? error.message
        : "Unknown error";
    await finish({ status: "failed", error: message });
    return { status: "failed", provider: provider.id, error: message };
  }
}
