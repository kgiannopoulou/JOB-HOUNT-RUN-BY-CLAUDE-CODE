import { CircleCheck, CircleDashed, CircleX } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { categoryLabels, type ScoredRequirement } from "@/lib/matching/score";

const statuses = {
  met: { label: "Met", icon: CircleCheck, className: "text-primary" },
  partial: { label: "Partly met", icon: CircleDashed, className: "text-muted-foreground" },
  not_met: { label: "Not met", icon: CircleX, className: "text-destructive" },
} as const;

export function RequirementList({ requirements }: { requirements: ScoredRequirement[] }) {
  return (
    <ul className="space-y-4">
      {requirements.map((requirement) => {
        const status = statuses[requirement.status];
        const Icon = status.icon;
        return (
          <li key={`${requirement.category}-${requirement.requirement}`} className="flex gap-2 text-sm">
            <Icon className={`mt-0.5 size-4 shrink-0 ${status.className}`} aria-hidden />
            <div className="min-w-0 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-medium">{requirement.requirement}</p>
                <Badge variant="outline">{status.label}</Badge>
                <Badge variant="secondary">{categoryLabels[requirement.category]}</Badge>
              </div>
              <p className="text-muted-foreground">{requirement.explanation}</p>
              <p className="text-xs text-muted-foreground">
                Job says: “{requirement.job_quote}”
              </p>
              {requirement.evidence && (
                <p className="text-xs text-muted-foreground">
                  Your CV: “{requirement.evidence}”
                </p>
              )}
              {requirement.adjustment && <p className="text-xs">{requirement.adjustment}</p>}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
