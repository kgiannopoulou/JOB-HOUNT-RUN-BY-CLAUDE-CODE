import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Mail } from "lucide-react";

import { NewLetterForm } from "@/components/letters/new-letter-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatDay } from "@/lib/applications/schema";
import { toneDetails, type LetterTone } from "@/lib/letters/letter";
import { isAiConfigured } from "@/server/ai/gateway";
import { requireUser } from "@/server/auth/user";
import { listVerifiedCvs } from "@/server/builder/queries";
import { listJobChoices } from "@/server/jobs/choices";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Cover letters" };

/** Server actions on this page can wait for a model response. */
export const maxDuration = 240;

export default async function CoverLettersPage({ searchParams }: PageProps<"/cover-letters">) {
  await requireUser("/cover-letters");
  const { job } = await searchParams;
  const selected = typeof job === "string" && /^[\da-f-]{36}$/i.test(job) ? job : undefined;

  const supabase = await createClient();
  const [letters, cvs, jobs] = await Promise.all([
    supabase
      .from("cover_letters")
      .select("id, company, role_title, tone, reviewed_at, is_edited, created_at")
      .order("created_at", { ascending: false }),
    listVerifiedCvs(supabase),
    listJobChoices(supabase, selected),
  ]);
  if (letters.error) throw new Error(`Letter list failed: ${letters.error.code}`);

  const aiReady = isAiConfigured();

  return (
    <>
      <PageHeader
        title="Cover letters"
        description="Generate a letter from your confirmed CV, edit it, and export it as a PDF."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-3">
          {letters.data.length === 0 ? (
            <EmptyState
              icon={Mail}
              title="No cover letters yet"
              description="Each letter you generate is saved separately, so you can compare them."
            />
          ) : (
            <ul className="space-y-3">
              {letters.data.map((letter) => (
                <li key={letter.id}>
                  <Card>
                    <CardContent>
                      <Link
                        href={`/cover-letters/${letter.id}`}
                        className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <Mail className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {letter.role_title}, {letter.company}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {toneDetails[letter.tone as LetterTone]?.label} ·{" "}
                            {formatDay(letter.created_at)}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            <Badge variant="outline">
                              {letter.reviewed_at ? "Reviewed" : "Needs your review"}
                            </Badge>
                            {letter.is_edited && <Badge variant="secondary">Edited</Badge>}
                          </span>
                        </span>
                        <ChevronRight
                          className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                          aria-hidden
                        />
                      </Link>
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle>New cover letter</CardTitle>
            <CardDescription>
              Your confirmed details, without your contact information, and the job are sent
              to Anthropic.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {!aiReady ? (
              <p role="status" className="text-sm text-muted-foreground">
                AI features are not set up on this server yet.
              </p>
            ) : cvs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/cv" className="underline">
                  Confirm a CV
                </Link>{" "}
                first. Letters are written only from details you have checked.
              </p>
            ) : jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                <Link href="/jobs" className="underline">
                  Save a job
                </Link>{" "}
                first, so there is a job description to write to.
              </p>
            ) : (
              <NewLetterForm cvs={cvs} jobs={jobs} selectedJob={selected} />
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
