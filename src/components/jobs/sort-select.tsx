"use client";

import { Label } from "@/components/ui/label";
import type { JobSort } from "@/lib/job-filters";

export function SortSelect({ value }: { value: JobSort }) {
  return (
    <div className="flex items-center gap-2">
      <Label htmlFor="sort" className="text-muted-foreground">
        Sort by
      </Label>
      <select
        id="sort"
        name="sort"
        form="job-filters"
        defaultValue={value}
        onChange={(event) => event.currentTarget.form?.requestSubmit()}
        className="h-8 rounded-lg border border-input bg-background px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <option value="date">Newest</option>
        <option value="relevance">Relevance</option>
      </select>
    </div>
  );
}
