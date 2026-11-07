import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, RotateCcw, ShieldAlert, Trash2, TriangleAlert } from "lucide-react";
import { z } from "zod";

import { LetterEditor } from "@/components/letters/letter-editor";
import { ActionButton } from "@/components/shared/action-button";
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
import { unsupportedCharacters } from "@/lib/cv/document";
import {
  letterWarnings,
  toneDetails,
  type LetterTone,
  type RemovedSentence,
} from "@/lib/letters/letter";
import { requireUser } from "@/server/auth/user";
import { parseProfile } from "@/server/cv/queries";
import { deleteCoverLetter, restoreCoverLetter } from "@/server/letters/actions";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "Cover letter" };

/** Private to one user, so there is no shared shell to prerender for each id. */
export const instant = false;

export default async function CoverLetterPage({ params }: PageProps<"/cover-letters/[id]">) {
  const { id } = await params;
  await requireUser(`/cover-letters/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const { data: letter, error } = await supabase
    .from("cover_letters")
    .select("*, resumes (content)")
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Letter lookup failed: ${error.code}`);
  if (!letter) notFound();

  const profile = parseProfile(letter.resumes?.content);
  const warnings = letterWarnings(letter.content, letter.company, letter.role_title, profile);
  const removed = letter.removed_sentences as unknown as RemovedSentence[];
  const reviewed = Boolean(letter.reviewed_at);
  const badCharacters = unsupportedCharacters(letter.content);
  const fields = { letterId: id };

  return (
    <>
      <PageHeader
        title={`${letter.role_title}, ${letter.company}`}
        description={`${toneDetails[letter.tone as LetterTone]?.label ?? letter.tone} tone`}
      >
        {reviewed && badCharacters.length === 0 && (
          <Button asChild size="lg">
            <a href={`/cover-letters/${id}/pdf`}>
              <Download data-icon="inline-start" /> Download PDF
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        <Badge variant={reviewed ? "secondary" : "outline"}>
          {reviewed ? "Reviewed" : "Needs your review"}
        </Badge>
        {letter.is_edited && <Badge variant="secondary">Edited</Badge>}
        <Button asChild variant="link">
          <Link href="/cover-letters">Back to all letters</Link>
        </Button>
      </div>

      {badCharacters.length > 0 && (
        <p role="alert" className="flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          The PDF fonts cover Latin, Greek and Cyrillic text. Remove these characters to
          export: {badCharacters.join(" ")}
        </p>
      )}

      {warnings.length > 0 && (
        <div role="note" className="flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          <ul className="space-y-1">
            {warnings.map((warning) => (
              <li key={warning.label}>
                <span className="font-medium">{warning.label}:</span> {warning.detail}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="grid items-start gap-6 lg:grid-cols-[1fr_22rem]">
        <Card className="min-w-0">
          <CardHeader>
            <CardTitle>Your letter</CardTitle>
            <CardDescription>
              Check every sentence. The PDF adds your contact details, the date and the line
              &quot;Application for {letter.role_title} at {letter.company}&quot;.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LetterEditor letterId={id} content={letter.content} reviewed={reviewed} />
          </CardContent>
        </Card>

        <div className="min-w-0 space-y-6">
          {removed.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldAlert className="size-4" aria-hidden /> Sentences removed
                </CardTitle>
                <CardDescription>
                  These named something your CV does not contain. If one is true, add it
                  yourself.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3 text-sm">
                  {removed.map((item) => (
                    <li key={item.sentence}>
                      <p className="break-words line-through">{item.sentence}</p>
                      <p className="text-xs text-muted-foreground">
                        Not in your CV: {item.terms.join(", ")}
                      </p>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          {letter.is_edited && (
            <Card>
              <CardHeader>
                <CardTitle>Generated text</CardTitle>
                <CardDescription>The AI&apos;s original is kept. Going back replaces your edits.</CardDescription>
              </CardHeader>
              <CardContent>
                <ActionButton
                  action={restoreCoverLetter}
                  fields={fields}
                  pendingLabel="Restoring…"
                  variant="outline"
                  confirmLabel="Yes, replace my edits"
                >
                  <RotateCcw data-icon="inline-start" /> Restore generated text
                </ActionButton>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>Delete this letter</CardTitle>
              <CardDescription>This cannot be undone.</CardDescription>
            </CardHeader>
            <CardContent>
              <ActionButton
                action={deleteCoverLetter}
                fields={fields}
                pendingLabel="Deleting…"
                variant="destructive"
                confirmLabel="Yes, delete this letter"
              >
                <Trash2 data-icon="inline-start" /> Delete letter
              </ActionButton>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
