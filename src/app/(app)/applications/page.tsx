import type { Metadata } from "next";

import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import { Badge } from "@/components/ui/badge";

export const metadata: Metadata = { title: "Applications" };

const stages = [
  "Saved",
  "Applied",
  "Screening",
  "Interview",
  "Offer",
  "Closed",
];

export default function ApplicationsPage() {
  return (
    <>
      <PageHeader
        title="Applications"
        description="Follow every application from saved to offer, with a record of what you sent."
      >
        <PhaseBadge phase={8} />
      </PageHeader>

      <div
        role="region"
        aria-label="Application pipeline"
        tabIndex={0}
        className="-mx-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:mx-0 md:px-0"
      >
        <ul className="flex min-w-max gap-3 xl:grid xl:min-w-0 xl:grid-cols-6">
          {stages.map((stage) => (
            <li
              key={stage}
              className="flex w-52 flex-col gap-3 rounded-xl bg-muted/60 p-3 xl:w-auto"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{stage}</h2>
                <Badge variant="secondary">0</Badge>
              </div>
              <div className="flex h-40 items-center justify-center rounded-lg border border-dashed px-3 text-center text-xs text-muted-foreground lg:h-72">
                No applications
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
