import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { pdfFileName, unsupportedCharacters } from "@/lib/cv/document";
import { letterParagraphs } from "@/lib/letters/letter";
import { getCurrentUser } from "@/server/auth/user";
import { parseProfile } from "@/server/cv/queries";
import { pdfResponseHeaders, renderLetterPdf } from "@/server/export/pdf";
import { createClient } from "@/server/supabase/server";

const dateFormat = new Intl.DateTimeFormat("en-GB", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** Exports a letter the user has reviewed. Row level security limits the lookup to them. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/cover-letters/[id]/pdf">,
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!z.uuid().safeParse(id).success) return new NextResponse("Not found", { status: 404 });

  const supabase = await createClient();
  const { data: letter, error } = await supabase
    .from("cover_letters")
    .select("id, company, role_title, content, reviewed_at, resumes (content)")
    .eq("id", id)
    .maybeSingle();
  if (error || !letter) return new NextResponse("Not found", { status: 404 });

  if (!letter.reviewed_at) {
    return new NextResponse("Review this letter before exporting it.", { status: 409 });
  }
  if (unsupportedCharacters(letter.content).length > 0) {
    return new NextResponse("This letter has characters the PDF fonts cannot show.", {
      status: 422,
    });
  }

  const contact = parseProfile(letter.resumes?.content)?.contact;
  const title = `Cover letter ${letter.role_title} ${letter.company}`;
  const pdf = await renderLetterPdf(
    {
      name: contact?.full_name ?? "",
      contact: [contact?.email, contact?.phone, contact?.location].filter(
        (value): value is string => Boolean(value),
      ),
      date: dateFormat.format(new Date()),
      subject: `Application for ${letter.role_title} at ${letter.company}`,
      paragraphs: letterParagraphs(letter.content),
    },
    title,
  );

  return new NextResponse(new Uint8Array(pdf), {
    headers: pdfResponseHeaders(pdfFileName(title, "cover-letter"), pdf.length),
  });
}
