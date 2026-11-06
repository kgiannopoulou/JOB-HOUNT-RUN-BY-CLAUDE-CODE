import type { Metadata } from "next";
import { BriefcaseBusiness, MapPin, Search } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const metadata: Metadata = { title: "Jobs" };

const filters = ["Remote", "Hybrid", "On-site", "Junior", "Mid-level", "Senior"];

export default function JobsPage() {
  return (
    <>
      <PageHeader
        title="Jobs"
        description="Search for roles, or add one you found elsewhere, and see how well you fit."
      >
        <Button disabled size="lg">
          Add a job
        </Button>
      </PageHeader>

      <Card>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-medium">Search</h2>
            <PhaseBadge phase={5} />
          </div>
          <form className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
            <div className="space-y-2">
              <Label htmlFor="keywords">Keywords</Label>
              <div className="relative">
                <Search
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="keywords"
                  placeholder="Job title or skill"
                  className="h-10 pl-9"
                  disabled
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <div className="relative">
                <MapPin
                  className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden
                />
                <Input
                  id="location"
                  placeholder="City, country or remote"
                  className="h-10 pl-9"
                  disabled
                />
              </div>
            </div>
            <Button type="button" size="lg" className="h-10" disabled>
              Search
            </Button>
          </form>
          <ul className="flex flex-wrap gap-2" aria-label="Filters">
            {filters.map((filter) => (
              <li key={filter}>
                <Badge variant="outline" className="opacity-60">
                  {filter}
                </Badge>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <EmptyState
        icon={BriefcaseBusiness}
        title="No jobs yet"
        description="Job search connects in Phase 5. Results will show a match score against your CV."
      />
    </>
  );
}
