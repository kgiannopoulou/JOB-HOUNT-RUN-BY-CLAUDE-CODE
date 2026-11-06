import type { NormalizedJob } from "@/server/jobs/types";

export type ExistingJob = {
  id: string;
  provider: string;
  provider_job_id: string;
  fingerprint: string;
};

export type UpsertPlan = {
  inserts: NormalizedJob[];
  updates: { id: string; job: NormalizedJob }[];
  /** Rows matched by a duplicate listing, kept alive by marking them as seen. */
  seenIds: string[];
  duplicates: number;
};

/**
 * Decides what to do with each fetched job. A job already stored for this
 * provider is updated. The same job under another ID, or from another
 * provider, is a duplicate and never gets a second row.
 */
export function planUpsert(
  incoming: NormalizedJob[],
  existing: ExistingJob[],
): UpsertPlan {
  const byProviderId = new Map(
    existing.map((row) => [`${row.provider}:${row.provider_job_id}`, row]),
  );
  const byFingerprint = new Map(existing.map((row) => [row.fingerprint, row]));

  const plan: UpsertPlan = { inserts: [], updates: [], seenIds: [], duplicates: 0 };
  const claimed = new Set<string>();

  for (const job of incoming) {
    const current = byProviderId.get(`${job.provider}:${job.providerJobId}`);

    if (current) {
      const owner = byFingerprint.get(job.fingerprint);
      const taken =
        claimed.has(job.fingerprint) || (owner && owner.id !== current.id);
      // If an edit makes this job look like another row, keep its old fingerprint.
      const fingerprint = taken ? current.fingerprint : job.fingerprint;
      claimed.add(fingerprint);
      plan.updates.push({ id: current.id, job: { ...job, fingerprint } });
      continue;
    }

    const twin = byFingerprint.get(job.fingerprint);
    if (twin || claimed.has(job.fingerprint)) {
      plan.duplicates += 1;
      if (twin) plan.seenIds.push(twin.id);
      continue;
    }

    claimed.add(job.fingerprint);
    plan.inserts.push(job);
  }

  return plan;
}
