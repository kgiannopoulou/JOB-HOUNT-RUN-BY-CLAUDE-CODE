import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileCheck2, FileText, Layers, ScanText, Sparkles } from "lucide-react";

import { NewVersionForm } from "@/components/builder/new-version-form";
import { UploadForm } from "@/components/cv/upload-form";
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
import { templateDetails, type CvTemplate } from "@/lib/cv/document";
import { isAiConfigured } from "@/server/ai/gateway";
import { requireUser } from "@/server/auth/user";
import { listVerifiedCvs, listVersions } from "@/server/builder/queries";
import { listJobChoices } from "@/server/jobs/choices";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "CV" };

/** Tailoring a version waits for a model response. */
export const maxDuration = 240;

const steps = [
  {
    icon: ScanText,
    title: "Read",
    text: "The text is read from your file and structured by AI.",
  },
  {
    icon: FileCheck2,
    title: "Confirm",
    text: "You check and correct everything before it is used.",
  },
  {
    icon: Sparkles,
    title: "Analyse",
    text: "See strengths, gaps and practical next steps.",
  },
];

const statusLabels = {
  pending: "Not read yet",
  parsing: "Reading",
  needs_review: "Needs your review",
  ready: "Confirmed",
  failed: "Could not be read",
} as const;

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "short",
  year: "numeric",
  timeZone: "UTC",
});

export default async function CvPage({ searchParams }: PageProps<"/cv">) {
  await requireUser("/cv");
  const { job } = await searchParams;
  const selectedJob = typeof job === "string" && /^[\da-f-]{36}$/i.test(job) ? job : undefined;
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, file_type, parse_status, is_primary, created_at")
    .eq("kind", "original")
    .order("created_at", { ascending: false });
  if (error) throw new Error(`CV list failed: ${error.code}`);

  const [versions, verifiedCvs, jobs] = await Promise.all([
    listVersions(supabase),
    listVerifiedCvs(supabase),
    listJobChoices(supabase, selectedJob),
  ]);

  return (
    <>
      <PageHeader
        title="CV"
        description="Upload your CV, confirm what was read from it, and see how to improve it."
      />

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <div className="min-w-0 space-y-3">
          {data.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No CV uploaded"
              description="Upload a CV to see an analysis and to compare it with jobs."
            />
          ) : (
            <ul className="space-y-3">
              {data.map((resume) => (
                <li key={resume.id}>
                  <Card>
                    <CardContent>
                      <Link
                        href={`/cv/${resume.id}`}
                        className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        <FileText className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium">
                            {resume.title}
                          </span>
                          <span className="block text-xs text-muted-foreground">
                            {resume.file_type?.toUpperCase()} · Uploaded{" "}
                            {dateFormat.format(new Date(resume.created_at))}
                          </span>
                          <span className="mt-1.5 flex flex-wrap gap-1.5">
                            {resume.is_primary && <Badge>Main CV</Badge>}
                            <Badge variant="outline">{statusLabels[resume.parse_status]}</Badge>
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
            <CardTitle>Upload a CV</CardTitle>
          </CardHeader>
          <CardContent>
            <UploadForm />
          </CardContent>
        </Card>
      </div>

      <section aria-labelledby="versions-heading" className="space-y-3">
        <div className="space-y-1">
          <h2 id="versions-heading" className="text-lg font-semibold tracking-tight">
            CV versions
          </h2>
          <p className="text-sm text-muted-foreground">
            Each version is saved separately and exports as a PDF. Your uploaded CV never changes.
          </p>
        </div>
        <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
          <div className="min-w-0">
            {versions.length === 0 ? (
              <EmptyState
                icon={Layers}
                title="No versions yet"
                description="Make a copy to customise, or tailor one for a job."
              />
            ) : (
              <ul className="space-y-3">
                {versions.map((version) => (
                  <li key={version.id}>
                    <Card>
                      <CardContent>
                        <Link
                          href={`/cv/versions/${version.id}`}
                          className="group flex items-center gap-3 rounded-md outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                        >
                          <Layers className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium">
                              {version.title}
                            </span>
                            <span className="block text-xs text-muted-foreground">
                              {templateDetails[version.template as CvTemplate]?.label} template ·
                              Created {dateFormat.format(new Date(version.created_at))}
                            </span>
                            <span className="mt-1.5 flex flex-wrap gap-1.5">
                              <Badge variant="outline">
                                {version.parse_status === "ready" ? "Reviewed" : "Needs your review"}
                              </Badge>
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

          <Card id="new-version">
            <CardHeader>
              <CardTitle>New version</CardTitle>
            </CardHeader>
            <CardContent>
              {verifiedCvs.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Confirm a CV&apos;s details first. Versions are built only from details you
                  have checked.
                </p>
              ) : (
                <NewVersionForm
                  cvs={verifiedCvs}
                  jobs={jobs}
                  selectedJob={selectedJob}
                  aiReady={isAiConfigured()}
                />
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>How it works</CardTitle>
          <CardDescription>
            Text from your CV is sent to Anthropic, our AI provider, only when you
            choose to run a step. Nothing is added to your CV without you seeing it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-6 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <h3 className="text-sm font-medium">{title}</h3>
                  <p className="text-sm text-muted-foreground">{text}</p>
                </div>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>
    </>
  );
}
