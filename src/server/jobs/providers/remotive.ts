import { z } from "zod";

import {
  htmlToText,
  inferExperienceLevel,
  jobFingerprint,
  parseLocations,
  parseSalary,
} from "@/server/jobs/normalize";
import {
  ProviderError,
  type JobProvider,
  type NormalizedJob,
  type ProviderResult,
} from "@/server/jobs/types";

// Terms: https://github.com/remotive-com/remote-jobs-api
// - At most 4 requests a day, and more than 2 a minute is blocked.
// - Link back to the Remotive URL and name Remotive as the source.
// - Do not submit jobs to other job platforms.
// - Do not show jobs in order to collect signups, which is why job search is public.
const endpoint = "https://remotive.com/api/remote-jobs";
const sixHours = 6 * 60 * 60 * 1000;

const listingSchema = z.object({
  id: z.number(),
  url: z.url({ protocol: /^https?$/ }),
  title: z.string().trim().min(1),
  company_name: z.string().trim().min(1),
  category: z.string().nullish(),
  tags: z.array(z.string()).nullish(),
  job_type: z.string().nullish(),
  publication_date: z.string().nullish(),
  candidate_required_location: z.string().nullish(),
  salary: z.string().nullish(),
  description: z.string().nullish(),
});

const responseSchema = z.object({ jobs: z.array(z.unknown()) });

const employmentTypes: Record<string, NormalizedJob["employmentType"]> = {
  full_time: "full_time",
  part_time: "part_time",
  contract: "contract",
  freelance: "freelance",
  internship: "internship",
};

/** Remotive dates have no time zone, so they are read as UTC. */
function parsePublicationDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const hasZone = /(z|[+-]\d{2}:?\d{2})$/i.test(value);
  const date = new Date(hasZone ? value : `${value}Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

export function normalizeRemotiveListing(listing: unknown): NormalizedJob | null {
  const parsed = listingSchema.safeParse(listing);
  if (!parsed.success) return null;
  const job = parsed.data;

  const locationRaw = job.candidate_required_location?.trim() ?? "";
  const locations = parseLocations(locationRaw);
  const salaryText = job.salary?.trim() || null;
  // Remotive documents salaries as usually yearly and in USD.
  const salary = parseSalary(salaryText, "USD");
  const employmentType = employmentTypes[job.job_type ?? ""] ?? "unknown";

  return {
    provider: "remotive",
    providerJobId: String(job.id),
    fingerprint: jobFingerprint({
      company: job.company_name,
      title: job.title,
      locations,
    }),
    title: job.title,
    company: job.company_name,
    description: htmlToText(job.description ?? ""),
    sourceUrl: job.url,
    locationRaw,
    locations,
    city: null,
    remotePolicy: "remote",
    employmentType,
    experienceLevel:
      employmentType === "internship"
        ? "intern"
        : inferExperienceLevel(job.title),
    category: job.category?.trim() || null,
    tags: job.tags ?? [],
    salaryText,
    salaryMin: salary?.min ?? null,
    salaryMax: salary?.max ?? null,
    salaryCurrency: salary?.currency ?? null,
    salaryAnnualMin: salary?.annualMin ?? null,
    salaryAnnualMax: salary?.annualMax ?? null,
    postedAt: parsePublicationDate(job.publication_date),
  };
}

async function fetchJobs(): Promise<ProviderResult> {
  let response: Response;
  try {
    response = await fetch(endpoint, {
      headers: { Accept: "application/json", "User-Agent": "JOB-HUNT/0.1" },
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
  } catch (error) {
    throw new ProviderError(
      "unavailable",
      `Remotive could not be reached: ${error instanceof Error ? error.name : "unknown error"}`,
    );
  }

  // Never retried here: a retry would use up the provider's small request allowance.
  if (response.status === 429) {
    const retryAfter = Number(response.headers.get("retry-after"));
    throw new ProviderError(
      "rate_limited",
      "Remotive rate limit reached",
      Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    );
  }
  if (!response.ok) {
    throw new ProviderError(
      "unavailable",
      `Remotive returned status ${response.status}`,
    );
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    throw new ProviderError("invalid_response", "Remotive did not return JSON");
  }

  const parsed = responseSchema.safeParse(body);
  if (!parsed.success) {
    throw new ProviderError(
      "invalid_response",
      "Remotive response has no jobs list",
    );
  }

  const normalized = parsed.data.jobs.map(normalizeRemotiveListing);
  const jobs = normalized.filter((job) => job !== null);
  return { jobs, skipped: normalized.length - jobs.length };
}

export const remotiveProvider: JobProvider = {
  id: "remotive",
  name: "Remotive",
  minSyncIntervalMs: sixHours,
  fetchJobs,
};
