import type { Metadata } from "next";
import { FileCheck2, FileText, ScanText, Upload } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import { requireUser } from "@/server/auth/user";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "CV" };

const steps = [
  {
    icon: Upload,
    title: "Upload",
    text: "Add a PDF or DOCX of up to 5 MB.",
  },
  {
    icon: ScanText,
    title: "Review",
    text: "Check and correct the details read from your file.",
  },
  {
    icon: FileCheck2,
    title: "Tailor",
    text: "Create a version for each role you apply to.",
  },
];

export default async function CvPage() {
  await requireUser("/cv");

  return (
    <>
      <PageHeader
        title="CV"
        description="Keep one master CV and a tailored version for each role."
      />

      <EmptyState
        icon={FileText}
        title="No CV uploaded"
        description="Your master CV will appear here. Uploading connects in Phase 5."
      >
        <div className="flex flex-col items-center gap-2">
          <Button size="lg" disabled>
            <Upload data-icon="inline-start" /> Upload CV
          </Button>
          <PhaseBadge phase={5} />
        </div>
      </EmptyState>

      <Card>
        <CardHeader>
          <CardTitle>How it will work</CardTitle>
          <CardDescription>
            Your CV stays private and tailored text is always yours to review.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ol className="grid gap-6 sm:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }) => (
              <li key={title} className="flex gap-3">
                <Icon
                  className="mt-0.5 size-5 shrink-0 text-primary"
                  aria-hidden
                />
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
