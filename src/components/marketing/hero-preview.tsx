import { Check, Sparkles, TriangleAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";

const score = 82;
const radius = 34;
const circumference = 2 * Math.PI * radius;

const matched = ["SQL", "Python", "Dashboards", "A/B testing"];
const gaps = ["dbt"];
const stages = [
  { label: "Saved", width: "w-full" },
  { label: "Applied", width: "w-3/4" },
  { label: "Interview", width: "w-2/5" },
  { label: "Offer", width: "w-1/6" },
];

/** A static illustration of the planned job match view. It is labelled as an example in the UI. */
export function HeroPreview() {
  return (
    <figure className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[2rem] bg-accent/70 blur-2xl"
      />
      <div className="rounded-2xl border bg-card p-5 shadow-lg sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <Badge variant="secondary">Example</Badge>
            <p className="mt-3 text-lg font-semibold tracking-tight">
              Product Data Analyst
            </p>
            <p className="text-sm text-muted-foreground">
              Sample Company · Remote, EU
            </p>
          </div>
          <div className="relative size-20 shrink-0">
            <svg viewBox="0 0 80 80" className="-rotate-90" aria-hidden>
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                strokeWidth="7"
                className="stroke-muted"
              />
              <circle
                cx="40"
                cy="40"
                r={radius}
                fill="none"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={circumference * (1 - score / 100)}
                className="stroke-primary"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-lg font-semibold">
              {score}
            </span>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Skills found in your CV
          </p>
          <ul className="flex flex-wrap gap-1.5">
            {matched.map((skill) => (
              <li key={skill}>
                <Badge variant="secondary">
                  <Check aria-hidden /> {skill}
                </Badge>
              </li>
            ))}
            {gaps.map((skill) => (
              <li key={skill}>
                <Badge variant="outline">
                  <TriangleAlert aria-hidden /> {skill}
                </Badge>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-5 flex gap-3 rounded-lg bg-accent p-3 text-sm text-accent-foreground">
          <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden />
          <p>
            Lead with your experiment analysis work. It answers the first
            requirement directly.
          </p>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:ml-16">
        <p className="text-xs font-medium text-muted-foreground">
          Your pipeline
        </p>
        <ul className="mt-3 space-y-2">
          {stages.map((stage) => (
            <li key={stage.label} className="flex items-center gap-3 text-xs">
              <span className="w-16 shrink-0 text-muted-foreground">
                {stage.label}
              </span>
              <span className="h-2 flex-1 rounded-full bg-muted">
                <span
                  className={`block h-2 rounded-full bg-primary ${stage.width}`}
                />
              </span>
            </li>
          ))}
        </ul>
      </div>
      <figcaption className="mt-3 text-center text-xs text-muted-foreground">
        Illustration of the planned interface, not real data.
      </figcaption>
    </figure>
  );
}
