import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, PencilLine, ScanText, Sparkles, Star, Trash2 } from "lucide-react";
import { z } from "zod";

import { AnalysisDashboard } from "@/components/cv/analysis-dashboard";
import { ReviewForm } from "@/components/cv/review-form";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { CV_ANALYSIS_PROMPT_VERSION, type CvAnalysisResult } from "@/lib/cv/analysis";
import { findUngrounded } from "@/lib/cv/grounding";
import { isAiConfigured } from "@/server/ai/gateway";
import { contentHash } from "@/server/ai/hash";
import { requireUser } from "@/server/auth/user";
import {
  analyzeCv,
  deleteCv,
  enterDetailsManually,
  extractCvDetails,
  setPrimaryCv,
} from "@/server/cv/actions";
import { aiCallsUsedToday, getResume, parseProfile } from "@/server/cv/queries";
import { aiDailyLimit } from "@/server/env";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "CV details" };

/** Server actions on this page can wait for a model response. */
export const maxDuration = 240;

/** Private to one user, so there is no shared shell to prerender for each id. */
export const instant = false;

export default async function CvDetailPage({
  params,
  searchParams,
}: PageProps<"/cv/[id]">) {
  const { id } = await params;
  const { edit } = await searchParams;
  await requireUser(`/cv/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const resume = await getResume(supabase, id);
  if (!resume) notFound();

  const profile = parseProfile(resume.content);
  const aiReady = isAiConfigured();
  const fields = { resumeId: id };
  const verified = resume.parse_status === "ready" && Boolean(resume.verified_at);
  const reviewing =
    profile && (resume.parse_status === "needs_review" || (verified && edit === "1"));

  const { data: analyses, error } = await supabase
    .from("cv_analyses")
    .select("result, profile_hash, prompt_version, model, created_at")
    .eq("resume_id", id)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(`Analysis lookup failed: ${error.code}`);
  const analysis = analyses[0];
  const upToDate =
    Boolean(analysis) &&
    Boolean(profile) &&
    analysis.profile_hash === contentHash(profile) &&
    analysis.prompt_version === CV_ANALYSIS_PROMPT_VERSION;

  const used = verified ? await aiCallsUsedToday(supabase) : 0;
  const limit = aiDailyLimit();

  return (
    <>
      <PageHeader title={resume.title} description={`Original file: ${resume.file_name ?? "not stored"}`}>
        {resume.storage_path && (
          <Button asChild variant="outline" size="lg">
            <a href={`/cv/${id}/download`}>
              <Download data-icon="inline-start" /> Original
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {resume.is_primary && <Badge>Main CV</Badge>}
        {verified && <Badge variant="secondary">Details confirmed</Badge>}
        <Button asChild variant="link">
          <Link href="/cv">Back to all CVs</Link>
        </Button>
      </div>

      {(resume.parse_status === "pending" ||
        resume.parse_status === "parsing" ||
        resume.parse_status === "failed") && (
        <EmptyState
          icon={ScanText}
          title={
            resume.parse_status === "failed"
              ? "We could not structure your CV"
              : "Your file is stored. Next, read its details"
          }
          description={
            resume.parse_error ??
            (aiReady
              ? "The text of your CV will be sent to Anthropic to organise it into sections. You will check the result before it is used."
              : "AI features are not set up on this server yet, so you can enter your details by hand.")
          }
        >
          <div className="flex flex-wrap items-start justify-center gap-2">
            {aiReady && (
              <ActionButton
                action={extractCvDetails}
                fields={fields}
                pendingLabel="Reading your CV…"
              >
                <ScanText data-icon="inline-start" />
                {resume.parse_status === "failed" ? "Try again" : "Read my CV"}
              </ActionButton>
            )}
            {resume.parse_status !== "parsing" && (
              <ActionButton
                action={enterDetailsManually}
                fields={fields}
                pendingLabel="Opening…"
                variant="outline"
              >
                <PencilLine data-icon="inline-start" /> Enter details by hand
              </ActionButton>
            )}
          </div>
        </EmptyState>
      )}

      {reviewing && (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Check your details</h2>
            <p className="text-sm text-muted-foreground">
              AI can misread a CV. Correct anything that is wrong. Only what you
              confirm here is used for analysis and job matching.
            </p>
          </div>
          <ReviewForm
            resumeId={id}
            initial={profile}
            flagged={findUngrounded(profile, resume.extracted_text ?? "")}
            verified={verified}
          />
        </>
      )}

      {verified && !reviewing && profile && (
        <>
          <div className="flex flex-wrap items-start gap-2">
            <Button asChild variant="outline" size="lg">
              <Link href={`/cv/${id}?edit=1`}>
                <PencilLine data-icon="inline-start" /> Edit details
              </Link>
            </Button>
            {!upToDate && aiReady && (
              <ActionButton action={analyzeCv} fields={fields} pendingLabel="Analysing your CV…">
                <Sparkles data-icon="inline-start" />
                {analysis ? "Update analysis" : "Analyse my CV"}
              </ActionButton>
            )}
            {!resume.is_primary && (
              <ActionButton
                action={setPrimaryCv}
                fields={fields}
                pendingLabel="Saving…"
                variant="outline"
              >
                <Star data-icon="inline-start" /> Make main CV
              </ActionButton>
            )}
          </div>

          {!aiReady && (
            <p role="status" className="text-sm text-muted-foreground">
              AI features are not set up on this server yet, so analysis is unavailable.
            </p>
          )}
          {aiReady && (
            <p className="text-xs text-muted-foreground">
              {used} of {limit} AI requests used in the last 24 hours.
            </p>
          )}

          {analysis ? (
            <>
              {!upToDate && (
                <p role="status" className="rounded-lg border p-3 text-sm">
                  Your details have changed since this analysis was made.
                </p>
              )}
              <AnalysisDashboard
                result={analysis.result as unknown as CvAnalysisResult}
                profile={profile}
              />
            </>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No analysis yet"
              description="Your confirmed details, without your contact information, will be sent to Anthropic for review."
            />
          )}
        </>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Delete this CV</CardTitle>
          <CardDescription>
            This removes the original file, its analysis and its job match results.
            It cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deleteCv}
            fields={fields}
            pendingLabel="Deleting…"
            variant="destructive"
            confirmLabel="Yes, delete this CV and its results"
          >
            <Trash2 data-icon="inline-start" /> Delete CV
          </ActionButton>
        </CardContent>
      </Card>
    </>
  );
}
