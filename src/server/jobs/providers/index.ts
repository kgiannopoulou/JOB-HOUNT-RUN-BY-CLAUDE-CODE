import { remotiveProvider } from "@/server/jobs/providers/remotive";
import type { JobProvider } from "@/server/jobs/types";

export const jobProviders: JobProvider[] = [remotiveProvider];
