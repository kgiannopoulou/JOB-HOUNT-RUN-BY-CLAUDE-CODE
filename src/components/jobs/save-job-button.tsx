"use client";

import { Bookmark, BookmarkCheck } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { toggleSavedJob } from "@/server/jobs/actions";

function Submit({ saved, title }: { saved: boolean; title: string }) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={saved ? "secondary" : "outline"}
      size="lg"
      disabled={pending}
      aria-pressed={saved}
      aria-label={`${saved ? "Remove" : "Save"} ${title}`}
    >
      {saved ? (
        <BookmarkCheck data-icon="inline-start" />
      ) : (
        <Bookmark data-icon="inline-start" />
      )}
      {saved ? "Saved" : "Save"}
    </Button>
  );
}

type SaveJobButtonProps = {
  jobId: string;
  title: string;
  saved: boolean;
  returnTo: string;
};

export function SaveJobButton({
  jobId,
  title,
  saved,
  returnTo,
}: SaveJobButtonProps) {
  return (
    <form action={toggleSavedJob}>
      <input type="hidden" name="jobId" value={jobId} />
      <input type="hidden" name="saved" value={String(saved)} />
      <input type="hidden" name="returnTo" value={returnTo} />
      <Submit saved={saved} title={title} />
    </form>
  );
}
