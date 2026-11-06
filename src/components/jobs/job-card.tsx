import { Building2, CalendarDays, ExternalLink, MapPin } from "lucide-react";

import { SaveJobButton } from "@/components/jobs/save-job-button";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  employmentOptions,
  experienceOptions,
  remoteOptions,
} from "@/lib/job-filters";
import { providerName } from "@/lib/job-providers";

export type JobCardData = {
  id: string;
  provider: string;
  title: string;
  company: string;
  description: string;
  source_url: string;
  location_raw: string;
  remote_policy: string;
  employment_type: string;
  experience_level: string;
  salary_text: string | null;
  posted_at: string | null;
};

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

function label(options: readonly { value: string; label: string }[], value: string) {
  return options.find((option) => option.value === value)?.label;
}

type JobCardProps = {
  job: JobCardData;
  saved: boolean;
  returnTo: string;
};

export function JobCard({ job, saved, returnTo }: JobCardProps) {
  const badges = [
    label(remoteOptions, job.remote_policy),
    label(employmentOptions, job.employment_type),
    label(experienceOptions, job.experience_level),
  ].filter(Boolean);
  const source = providerName(job.provider);

  return (
    <Card>
      <CardContent className="space-y-3">
        <div className="space-y-1">
          <h2 className="font-semibold tracking-tight">{job.title}</h2>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-1.5">
              <Building2 className="size-3.5" aria-hidden /> {job.company}
            </li>
            {job.location_raw && (
              <li className="flex items-center gap-1.5">
                <MapPin className="size-3.5" aria-hidden /> {job.location_raw}
              </li>
            )}
            {job.posted_at && (
              <li className="flex items-center gap-1.5">
                <CalendarDays className="size-3.5" aria-hidden />
                <time dateTime={job.posted_at}>
                  {dateFormat.format(new Date(job.posted_at))}
                </time>
              </li>
            )}
          </ul>
        </div>

        <ul className="flex flex-wrap gap-1.5">
          {badges.map((badge) => (
            <li key={badge}>
              <Badge variant="secondary">{badge}</Badge>
            </li>
          ))}
          {job.salary_text && (
            <li>
              <Badge variant="outline">{job.salary_text}</Badge>
            </li>
          )}
        </ul>

        {job.description && (
          <p className="line-clamp-2 text-sm text-muted-foreground">
            {job.description}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild size="lg">
            {/* No noreferrer: Remotive's terms ask for traffic to be sent back to them. */}
            <a href={job.source_url} target="_blank" rel="noopener">
              View on {source}{" "}
              <ExternalLink data-icon="inline-end" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
          <SaveJobButton
            jobId={job.id}
            title={job.title}
            saved={saved}
            returnTo={returnTo}
          />
        </div>
      </CardContent>
    </Card>
  );
}
