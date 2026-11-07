import { CircleCheck, CircleDashed, ShieldAlert } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { Tailoring } from "@/lib/cv/tailor";

/** Shows every change the AI made, so nothing reaches a PDF unseen. */
export function TailoringReport({ tailoring }: { tailoring: Tailoring }) {
  const found = tailoring.keywords.filter((keyword) => keyword.found);
  const missing = tailoring.keywords.filter((keyword) => !keyword.found);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Keywords for this job</CardTitle>
          <CardDescription>
            {found.length} of {tailoring.keywords.length} terms from the job are in your CV.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-6 sm:grid-cols-2">
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <CircleCheck className="size-4" aria-hidden /> In your CV
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {found.map((keyword) => (
                <li key={keyword.term}>
                  <Badge variant="secondary">{keyword.term}</Badge>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-1.5 text-sm font-medium">
              <CircleDashed className="size-4" aria-hidden /> Not in your CV
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {missing.map((keyword) => (
                <li key={keyword.term}>
                  <Badge variant="outline">{keyword.term}</Badge>
                </li>
              ))}
            </ul>
            {missing.length > 0 && (
              <p className="text-xs text-muted-foreground">
                These were not added. If one is true for you, add it yourself when you edit
                this version.
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>What the AI changed</CardTitle>
          <CardDescription>
            {tailoring.skills_reordered
              ? "Your skills were put in order of relevance. None were added or removed."
              : "Your skills were left as they were."}{" "}
            Job titles, employers, dates and qualifications are copied from your confirmed CV.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {tailoring.changes.length === 0 && (
            <p className="text-sm text-muted-foreground">No wording was changed.</p>
          )}
          {tailoring.changes.map((change) => (
            <div key={change.label} className="space-y-2 rounded-lg border p-3 text-sm">
              <h3 className="font-medium">{change.label}</h3>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Your confirmed text</p>
                  <p className="whitespace-pre-line break-words">{change.before || "Empty"}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">This version</p>
                  <p className="whitespace-pre-line break-words">{change.after}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {tailoring.rejected.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="size-4" aria-hidden /> AI wording that was thrown away
            </CardTitle>
            <CardDescription>
              These suggestions named something your CV does not contain, so your own text
              was kept.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {tailoring.rejected.map((rejection) => (
              <div key={rejection.label} className="rounded-lg border p-3 text-sm">
                <h3 className="font-medium">{rejection.label}</h3>
                <p className="text-muted-foreground">Not in your CV: {rejection.terms.join(", ")}</p>
                <p className="mt-1 whitespace-pre-line break-words line-through">
                  {rejection.proposed}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
