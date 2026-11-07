import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink, Trash2, TriangleAlert } from "lucide-react";
import { z } from "zod";

import { CheckMatchButton } from "@/components/jobs/check-match-button";
import { RequirementList } from "@/components/matching/requirement-list";
import { ScoreNotice } from "@/components/matching/score-notice";
import { ActionButton } from "@/components/shared/action-button";
import { PageHeader } from "@/components/shared/page-header";
import { ScoreMeter } from "@/components/shared/score-meter";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { bandLabels } from "@/lib/matching/score";
import { contentHash } from "@/server/ai/hash";
import { requireUser } from "@/server/auth/user";
import { parseProfile } from "@/server/cv/queries";
import { deleteMatch } from "@/server/matching/actions";
import { getMatch } from "@/server/matching/queries";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Match result" };

export const maxDuration = 240;

/** Private to one user, so there is no shared shell to prerender for each id. */
export const instant = false;

export default async function MatchPage({ params }: PageProps<"/matches/[id]">) {
  const { id } = await params;
  await requireUser(`/matches/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const match = await getMatch(supabase, id);
  if (!match) notFound();

  const { result, jobs: job } = match;
  const insufficient = result.band === "insufficient";
  const profile = parseProfile(match.resumes?.content);
  const stale = profile !== null && contentHash(profile) !== result.profile_hash;
  const mandatory = result.requirements.filter((r) => r.importance === "mandatory");
  const preferred = result.requirements.filter((r) => r.importance === "preferred");
  const gaps = result.requirements.filter((r) => r.status !== "met");

  return (
    <>
      <PageHeader
        title={job?.title ?? "Job no longer available"}
        description={`${job?.company ?? ""} · Compared with ${match.resumes?.title ?? "your CV"}`}
      >
        {job && (
          <Button asChild variant="outline" size="lg">
            <a href={job.source_url} target="_blank" rel="noopener">
              View job <ExternalLink data-icon="inline-end" aria-hidden />
              <span className="sr-only">(opens in a new tab)</span>
            </a>
          </Button>
        )}
      </PageHeader>

      <Button asChild variant="link" className="w-fit px-0">
        <Link href="/matches">Back to all matches</Link>
      </Button>

      {stale && job && (
        <div role="status" className="flex flex-wrap items-center gap-3 rounded-lg border p-3 text-sm">
          <p className="flex-1">Your CV has changed since this comparison was made.</p>
          <CheckMatchButton jobId={match.job_id} title={job.title} />
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[20rem_1fr]">
        <Card>
          <CardHeader>
            <CardTitle>Compatibility score</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-5xl font-semibold tabular-nums tracking-tight">
              {insufficient ? "–" : `${result.score}%`}
            </p>
            <Badge variant="secondary">{bandLabels[result.band]}</Badge>
            {result.limited_data && !insufficient && (
              <p className="flex gap-2 text-sm">
                <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
                Based on very few requirements, so treat this with care.
              </p>
            )}
            <ScoreNotice />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Evaluation</CardTitle>
            <CardDescription>{result.summary}</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            {result.categories.map((category) => (
              <ScoreMeter key={category.category} label={category.label} value={category.score} />
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Missing or weak areas</CardTitle>
          </CardHeader>
          <CardContent>
            {gaps.length === 0 ? (
              <p className="text-sm text-muted-foreground">None found.</p>
            ) : (
              <ul className="space-y-1 text-sm">
                {gaps.map((gap) => (
                  <li key={`${gap.category}-${gap.requirement}`} className="flex flex-wrap gap-2">
                    <span>{gap.requirement}</span>
                    <Badge variant={gap.importance === "mandatory" ? "default" : "outline"}>
                      {gap.importance === "mandatory" ? "Mandatory" : "Preferred"}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Strengths</CardTitle>
          </CardHeader>
          <CardContent>
            {result.strengths.length === 0 ? (
              <p className="text-sm text-muted-foreground">None could be confirmed from your CV.</p>
            ) : (
              <ul className="space-y-3 text-sm">
                {result.strengths.map((strength) => (
                  <li key={strength.text}>
                    <p>{strength.text}</p>
                    <p className="text-xs text-muted-foreground">Your CV: “{strength.evidence}”</p>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Potential concerns</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-sm">
              {result.concerns.map((concern) => (
                <li key={concern}>{concern}</li>
              ))}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>How to improve your application</CardTitle>
            <CardDescription>Only ever claim what is true for you.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-inside list-disc space-y-2 text-sm">
              {result.recommendations.map((recommendation) => (
                <li key={recommendation}>{recommendation}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mandatory requirements</CardTitle>
          <CardDescription>
            {result.mandatory.met} of {result.mandatory.total} met
          </CardDescription>
        </CardHeader>
        <CardContent>
          {mandatory.length === 0 ? (
            <p className="text-sm text-muted-foreground">None were identified.</p>
          ) : (
            <RequirementList requirements={mandatory} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Preferred requirements</CardTitle>
          <CardDescription>
            {result.preferred.met} of {result.preferred.total} met
          </CardDescription>
        </CardHeader>
        <CardContent>
          {preferred.length === 0 ? (
            <p className="text-sm text-muted-foreground">None were identified.</p>
          ) : (
            <RequirementList requirements={preferred} />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>How this score was calculated</CardTitle>
          <CardDescription>
            AI reads the job and your CV. The score itself comes from fixed rules.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="list-inside list-decimal space-y-2 text-sm">
            {result.explanation.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ol>
          {result.excluded_requirements.length > 0 && (
            <p className="text-xs text-muted-foreground">
              Left out: {result.excluded_requirements.join(", ")}
            </p>
          )}
        </CardContent>
      </Card>

      <ActionButton
        action={deleteMatch}
        fields={{ matchId: id }}
        pendingLabel="Deleting…"
        variant="outline"
      >
        <Trash2 data-icon="inline-start" /> Delete this result
      </ActionButton>
    </>
  );
}
