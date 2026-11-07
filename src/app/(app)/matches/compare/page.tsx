import type { Metadata } from "next";
import Link from "next/link";
import { Scale } from "lucide-react";
import { z } from "zod";

import { ScoreNotice } from "@/components/matching/score-notice";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { MAX_COMPARED_JOBS } from "@/lib/matching/result";
import { categories } from "@/lib/matching/schema";
import { bandLabels, categoryLabels, categoryWeights } from "@/lib/matching/score";
import { requireUser } from "@/server/auth/user";
import { getMatches } from "@/server/matching/queries";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Compare jobs" };

function selectedIds(value: string | string[] | undefined) {
  const list = Array.isArray(value) ? value : value ? [value] : [];
  return [...new Set(list)].filter((id) => z.uuid().safeParse(id).success);
}

const orderedCategories = [...categories].sort(
  (a, b) => categoryWeights[b] - categoryWeights[a],
);

export default async function ComparePage({ searchParams }: PageProps<"/matches/compare">) {
  await requireUser("/matches");
  const { id } = await searchParams;
  const ids = selectedIds(id);
  const tooMany = ids.length > MAX_COMPARED_JOBS;

  const supabase = await createClient();
  const matches = ids.length >= 2 && !tooMany ? await getMatches(supabase, ids) : [];

  if (matches.length < 2) {
    return (
      <>
        <PageHeader title="Compare jobs" description="See your matches side by side." />
        <EmptyState
          icon={Scale}
          title={tooMany ? `Choose up to ${MAX_COMPARED_JOBS} jobs` : "Choose at least two jobs"}
          description="Go back and select the jobs you want to compare."
        >
          <Button asChild size="lg">
            <Link href="/matches">Back to matches</Link>
          </Button>
        </EmptyState>
      </>
    );
  }

  const row = "border-t px-3 py-2 align-top";
  const heading = `${row} text-left font-medium`;

  return (
    <>
      <PageHeader title="Compare jobs" description="Ordered from the highest score to the lowest." />
      <Button asChild variant="link" className="w-fit px-0">
        <Link href="/matches">Back to all matches</Link>
      </Button>

      <Card>
        <CardContent className="overflow-x-auto">
          <table className="w-full min-w-[36rem] border-collapse text-sm">
            <caption className="sr-only">Comparison of selected job matches</caption>
            <thead>
              <tr>
                <td className="w-40" />
                {matches.map((match) => (
                  <th key={match.id} scope="col" className="px-3 pb-3 text-left align-top font-medium">
                    <Link href={`/matches/${match.id}`} className="underline-offset-2 hover:underline">
                      {match.jobs?.title ?? "Job no longer available"}
                    </Link>
                    <span className="block font-normal text-muted-foreground">
                      {match.jobs?.company}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <th scope="row" className={heading}>Compatibility score</th>
                {matches.map((match) => (
                  <td key={match.id} className={`${row} text-2xl font-semibold tabular-nums`}>
                    {match.result.band === "insufficient" ? "–" : `${match.score}%`}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={heading}>Result</th>
                {matches.map((match) => (
                  <td key={match.id} className={row}>{bandLabels[match.result.band]}</td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={heading}>Mandatory met</th>
                {matches.map(({ id: key, result }) => (
                  <td key={key} className={row}>
                    {result.mandatory.met} of {result.mandatory.total}
                  </td>
                ))}
              </tr>
              <tr>
                <th scope="row" className={heading}>Preferred met</th>
                {matches.map(({ id: key, result }) => (
                  <td key={key} className={row}>
                    {result.preferred.met} of {result.preferred.total}
                  </td>
                ))}
              </tr>
              {orderedCategories.map((category) => (
                <tr key={category}>
                  <th scope="row" className={heading}>{categoryLabels[category]}</th>
                  {matches.map(({ id: key, result }) => {
                    const score = result.categories.find((c) => c.category === category)?.score;
                    return (
                      <td key={key} className={`${row} tabular-nums`}>
                        {score === null || score === undefined ? "Not requested" : `${score}%`}
                      </td>
                    );
                  })}
                </tr>
              ))}
              <tr>
                <th scope="row" className={heading}>Mandatory gaps</th>
                {matches.map(({ id: key, result }) => {
                  const gaps = result.requirements.filter(
                    (r) => r.importance === "mandatory" && r.status === "not_met",
                  );
                  return (
                    <td key={key} className={row}>
                      {gaps.length === 0 ? "None" : gaps.map((gap) => gap.requirement).join(", ")}
                    </td>
                  );
                })}
              </tr>
            </tbody>
          </table>
        </CardContent>
      </Card>
      <ScoreNotice />
    </>
  );
}
