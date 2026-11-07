import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";

import { getCurrentUser } from "@/server/auth/user";
import { getResume } from "@/server/cv/queries";
import { createClient } from "@/server/supabase/server";

/** Sends the user to a link for their original file that expires after 60 seconds. */
export async function GET(
  request: NextRequest,
  { params }: RouteContext<"/cv/[id]/download">,
) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  if (!z.uuid().safeParse(id).success) {
    return new NextResponse("Not found", { status: 404 });
  }

  const supabase = await createClient();
  const resume = await getResume(supabase, id);
  if (!resume?.storage_path) return new NextResponse("Not found", { status: 404 });

  const { data, error } = await supabase.storage
    .from("cvs")
    .createSignedUrl(resume.storage_path, 60, {
      download: resume.file_name ?? true,
    });
  if (error) return new NextResponse("Not found", { status: 404 });

  return NextResponse.redirect(data.signedUrl);
}
