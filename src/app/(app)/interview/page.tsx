import type { Metadata } from "next";
import { BookOpenText, ListChecks, MessagesSquare, Mic } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { PhaseBadge } from "@/components/shared/phase-badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export const metadata: Metadata = { title: "Interview prep" };

const tools = [
  {
    icon: ListChecks,
    title: "Likely questions",
    text: "Questions built from the job description and your CV.",
  },
  {
    icon: Mic,
    title: "Practice sessions",
    text: "Answer in your own words and get structured feedback.",
  },
  {
    icon: BookOpenText,
    title: "STAR stories",
    text: "Turn your experience into clear, reusable examples.",
  },
];

export default function InterviewPage() {
  return (
    <>
      <PageHeader
        title="Interview prep"
        description="Prepare for each interview with questions and practice specific to the role."
      >
        <PhaseBadge phase={9} />
      </PageHeader>

      <section aria-label="Tools" className="grid gap-4 md:grid-cols-3">
        {tools.map(({ icon: Icon, title, text }) => (
          <Card key={title}>
            <CardHeader>
              <Icon className="mb-1 size-5 text-primary" aria-hidden />
              <CardTitle>{title}</CardTitle>
              <CardDescription>{text}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </section>

      <EmptyState
        icon={MessagesSquare}
        title="No practice sessions yet"
        description="Sessions you start from a job or application will be listed here."
      />
    </>
  );
}
