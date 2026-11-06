import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { PAGE_SIZE, type JobFilters } from "@/lib/job-filters";
import { expandLocation } from "@/lib/locations";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type JobListing =
  Database["public"]["Functions"]["search_jobs"]["Returns"][number];

const optional = <T,>(values: T[]) => (values.length ? values : undefined);

export async function searchJobs(client: Client, filters: JobFilters) {
  const { data, error } = await client.rpc("search_jobs", {
    p_title: filters.title || undefined,
    p_keywords: filters.keywords || undefined,
    p_company: filters.company || undefined,
    p_locations: filters.country ? expandLocation(filters.country) : undefined,
    p_city: filters.city || undefined,
    p_remote_policies: optional(filters.remote),
    p_employment_types: optional(filters.type),
    p_experience_levels: optional(filters.level),
    p_min_salary: filters.minSalary ?? undefined,
    p_sort: filters.sort,
    p_limit: PAGE_SIZE,
    p_offset: (filters.page - 1) * PAGE_SIZE,
  });
  if (error) throw new Error(`Job search failed: ${error.message}`);

  return { jobs: data, total: data[0]?.total_count ?? 0 };
}

export async function getLocationOptions(client: Client) {
  const { data, error } = await client.rpc("job_location_options");
  if (error) throw new Error(`Location options failed: ${error.message}`);
  return data.map((row) => row.location);
}

export async function getSavedJobIds(
  client: Client,
  userId: string,
  jobIds: string[],
) {
  if (jobIds.length === 0) return new Set<string>();
  const { data, error } = await client
    .from("saved_jobs")
    .select("job_id")
    .eq("user_id", userId)
    .in("job_id", jobIds);
  if (error) throw new Error(`Saved jobs failed: ${error.message}`);
  return new Set(data.map((row) => row.job_id));
}
