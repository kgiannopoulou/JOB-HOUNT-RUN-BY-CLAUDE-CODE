import type { Metadata } from "next";
import Link from "next/link";
import { Gauge, Scale } from "lucide-react";

import { ScoreNotice } from "@/components/matching/score-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_COMPARED_JOBS } from "@/lib/matching/result";
import { bandLabels } from "@/lib/matching/score";
import { requireUser } from "@/server/auth/user";
import { listMatches } from "@/server/matching/queries";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Matches" };

export default async function MatchesPage() {
  await requireUser("/matches");
  const supabase = await createClient();
  const matches = await listMatches(supabase);

  return (
    <>
      <PageHeader
        title="Matches"
        description="See how your confirmed CV compares with the jobs you have checked."
      />

      {matches.length === 0 ? (
        <EmptyState
          icon={Gauge}
          title="No matches yet"
          description="Choose Check match on any job to compare it with your confirmed CV."
        >
          <Button asChild size="lg">
            <Link href="/jobs">Search jobs</Link>
          </Button>
        </EmptyState>
      ) : (
        <form action="/matches/compare" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-muted-foreground">
              Select 2 to {MAX_COMPARED_JOBS} jobs to compare them side by side.
            </p>
            <Button type="submit" size="lg" variant="outline">
              <Scale data-icon="inline-start" /> Compare selected
            </Button>
          </div>

          <ul className="space-y-3">
            {matches.map((match) => {
              const title = match.jobs?.title ?? "Job no longer available";
              const insufficient = match.result.band === "insufficient";
              return (
                <li key={match.id}>
                  <Card>
                    <CardContent className="flex items-center gap-4">
                      <input
                        type="checkbox"
                        name="id"
                        value={match.id}
                        aria-label={`Select ${title}`}
                        className="size-4 shrink-0"
                      />
                      <p className="w-14 shrink-0 text-2xl font-semibold tabular-nums tracking-tight">
                        {insufficient ? "–" : `${match.score}%`}
                      </p>
                      <div className="min-w-0 flex-1">
                        <Link
                          href={`/matches/${match.id}`}
                          className="block truncate font-medium underline-offset-2 hover:underline"
                        >
                          {title}
                        </Link>
                        <p className="truncate text-sm text-muted-foreground">
                          {match.jobs?.company}
                        </p>
                      </div>
                      <Badge variant="outline" className="hidden sm:inline-flex">
                        {bandLabels[match.result.band]}
                      </Badge>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
          <ScoreNotice />
        </form>
      )}
    </>
  );
}
