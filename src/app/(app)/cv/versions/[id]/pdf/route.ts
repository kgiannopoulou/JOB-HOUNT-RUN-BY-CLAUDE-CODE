import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import {
  buildCvDocument,
  documentText,
  normalizeLayout,
  pdfFileName,
  unsupportedCharacters,
  type CvTemplate,
} from "@/lib/cv/document";
import { getCurrentUser } from "@/server/auth/user";
import { getVersion } from "@/server/builder/queries";
import { parseProfile } from "@/server/cv/queries";
import { pdfResponseHeaders, renderCvPdf } from "@/server/export/pdf";
import { createClient } from "@/server/supabase/server";

/** Exports a version the user has reviewed. Row level security limits the lookup to them. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/cv/versions/[id]/pdf">,
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const version = await getVersion(supabase, id);
  const profile = version && parseProfile(version.content);
  if (!version || !profile) return new NextResponse("Not found", { status: 404 });

  if (version.parse_status !== "ready" || !version.verified_at) {
    return new NextResponse("Review this version before exporting it.", { status: 409 });
  }

  const cv = buildCvDocument(profile, normalizeLayout(version.layout));
  if (unsupportedCharacters(documentText(cv)).length > 0) {
    return new NextResponse("This version has characters the PDF fonts cannot show.", {
      status: 422,
    });
  }

  const pdf = await renderCvPdf(cv, version.template as CvTemplate, version.title);
  return new NextResponse(new Uint8Array(pdf), {
    headers: pdfResponseHeaders(pdfFileName(version.title, "cv"), pdf.length),
  });
}
