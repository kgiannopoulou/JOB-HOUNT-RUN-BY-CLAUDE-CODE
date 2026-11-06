import type { Database } from "@/types/database";

type Enums = Database["public"]["Enums"];

/** The one shape every provider's data is converted into. */
export type NormalizedJob = {
  provider: string;
  providerJobId: string;
  fingerprint: string;
  title: string;
  company: string;
  description: string;
  sourceUrl: string;
  locationRaw: string;
  locations: string[];
  city: string | null;
  remotePolicy: Enums["remote_policy"];
  employmentType: Enums["employment_type"];
  experienceLevel: Enums["experience_level"];
  category: string | null;
  tags: string[];
  salaryText: string | null;
  salaryMin: number | null;
  salaryMax: number | null;
  salaryCurrency: string | null;
  salaryAnnualMin: number | null;
  salaryAnnualMax: number | null;
  postedAt: string | null;
};

export type ProviderResult = {
  jobs: NormalizedJob[];
  /** Listings dropped because they could not be read safely. */
  skipped: number;
};

/** Add a new source by implementing this and registering it in providers/index.ts. */
export interface JobProvider {
  id: string;
  name: string;
  /** Shortest gap between requests that the provider's terms allow. */
  minSyncIntervalMs: number;
  fetchJobs(): Promise<ProviderResult>;
}

export type ProviderErrorKind =
  | "rate_limited"
  | "unavailable"
  | "invalid_response";

export class ProviderError extends Error {
  constructor(
    readonly kind: ProviderErrorKind,
    message: string,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}
