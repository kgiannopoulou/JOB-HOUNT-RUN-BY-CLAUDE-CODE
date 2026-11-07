import { Info } from "lucide-react";

/** Shown wherever a score appears, so it is never read as a chance of being hired. */
export function ScoreNotice() {
  return (
    <p className="flex gap-2 text-xs text-muted-foreground">
      <Info className="mt-px size-3.5 shrink-0" aria-hidden />
      This score compares your confirmed CV with the job text. It is not the
      probability of being hired, and employers do not see it.
    </p>
  );
}
