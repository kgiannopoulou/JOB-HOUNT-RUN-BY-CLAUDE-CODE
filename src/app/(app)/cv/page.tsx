import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, FileCheck2, FileText, ScanText, Sparkles } from "lucide-react";

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
import { requireUser } from "@/server/auth/user";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "CV" };

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

export default async function CvPage() {
  await requireUser("/cv");
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("resumes")
    .select("id, title, file_type, parse_status, is_primary, created_at")
    .is("parent_resume_id", null)
    .order("created_at", { ascending: false });
  if (error) throw new Error(`CV list failed: ${error.code}`);

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
