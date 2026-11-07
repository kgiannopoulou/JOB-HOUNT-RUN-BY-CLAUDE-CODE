import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Download, PencilLine, ShieldCheck, Trash2, TriangleAlert } from "lucide-react";
import { z } from "zod";

import { LayoutEditor } from "@/components/builder/layout-editor";
import { TailoringReport } from "@/components/builder/tailoring-report";
import { ReviewForm } from "@/components/cv/review-form";
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
import {
  buildCvDocument,
  documentText,
  normalizeLayout,
  unsupportedCharacters,
  type CvTemplate,
} from "@/lib/cv/document";
import { versionWarnings, type Tailoring } from "@/lib/cv/tailor";
import { requireUser } from "@/server/auth/user";
import { deleteCvVersion, saveVersionProfile } from "@/server/builder/actions";
import { getVersion } from "@/server/builder/queries";
import { getResume, parseProfile } from "@/server/cv/queries";
import { createClient } from "@/server/supabase/server";

export const metadata: Metadata = { title: "CV version" };

/** Private to one user, so there is no shared shell to prerender for each id. */
export const instant = false;

export default async function CvVersionPage({
  params,
  searchParams,
}: PageProps<"/cv/versions/[id]">) {
  const { id } = await params;
  const { edit } = await searchParams;
  await requireUser(`/cv/versions/${id}`);
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await createClient();
  const version = await getVersion(supabase, id);
  const profile = version && parseProfile(version.content);
  if (!version || !profile) notFound();

  const source = version.parent_resume_id
    ? await getResume(supabase, version.parent_resume_id)
    : null;
  const sourceProfile = source && parseProfile(source.content);

  const confirmed = version.parse_status === "ready" && Boolean(version.verified_at);
  const reviewing = !confirmed || edit === "1";
  const tailoring = version.tailoring as unknown as Tailoring | null;
  const layout = normalizeLayout(version.layout);
  const badCharacters = unsupportedCharacters(documentText(buildCvDocument(profile, layout)));

  return (
    <>
      <PageHeader
        title={version.title}
        description={
          source ? `Made from ${source.title}, which stays unchanged.` : "The CV this came from has been deleted."
        }
      >
        {confirmed && badCharacters.length === 0 && (
          <Button asChild size="lg">
            <a href={`/cv/versions/${id}/pdf`}>
              <Download data-icon="inline-start" /> Download PDF
            </a>
          </Button>
        )}
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2">
        {confirmed ? (
          <Badge variant="secondary">
            <ShieldCheck aria-hidden /> Reviewed
          </Badge>
        ) : (
          <Badge variant="outline">Needs your review</Badge>
        )}
        <Button asChild variant="link">
          <Link href="/cv">Back to all CVs</Link>
        </Button>
      </div>

      {!confirmed && (
        <p role="status" className="flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          Read everything below and confirm it at the end of the page. This version cannot
          be exported until you do.
        </p>
      )}

      {badCharacters.length > 0 && (
        <p role="alert" className="flex gap-2 rounded-lg border p-3 text-sm">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
          The PDF fonts cover Latin, Greek and Cyrillic text. Remove these characters to
          export: {badCharacters.join(" ")}
        </p>
      )}

      {tailoring && <TailoringReport tailoring={tailoring} />}

      <LayoutEditor
        resumeId={id}
        title={version.title}
        template={version.template as CvTemplate}
        layout={layout}
        profile={profile}
      />

      {reviewing ? (
        <>
          <div className="space-y-1">
            <h2 className="text-lg font-semibold tracking-tight">Check this version</h2>
            <p className="text-sm text-muted-foreground">
              Changes here apply to this version only. Your original CV stays as it is.
            </p>
          </div>
          <ReviewForm
            resumeId={id}
            initial={profile}
            flagged={sourceProfile ? versionWarnings(profile, sourceProfile) : []}
            verified={confirmed}
            action={saveVersionProfile}
            flaggedText="These values are not in the confirmed CV this version came from:"
            confirmText="I have read this version and everything in it is true."
          />
        </>
      ) : (
        <Button asChild variant="outline" size="lg" className="w-fit">
          <Link href={`/cv/versions/${id}?edit=1`}>
            <PencilLine data-icon="inline-start" /> Edit this version
          </Link>
        </Button>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Delete this version</CardTitle>
          <CardDescription>
            Your original CV and other versions are not affected. This cannot be undone.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActionButton
            action={deleteCvVersion}
            fields={{ resumeId: id }}
            pendingLabel="Deleting…"
            variant="destructive"
            confirmLabel="Yes, delete this version"
          >
            <Trash2 data-icon="inline-start" /> Delete version
          </ActionButton>
        </CardContent>
      </Card>
    </>
  );
}
