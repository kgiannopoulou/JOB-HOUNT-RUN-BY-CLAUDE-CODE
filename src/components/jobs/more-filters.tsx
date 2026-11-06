"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

type MoreFiltersProps = {
  defaultOpen: boolean;
  children: React.ReactNode;
};

/** Collapsible on small screens. Always open on desktop, where there is room. */
export function MoreFilters({ defaultOpen, children }: MoreFiltersProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="more-filters"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-sm font-medium text-primary lg:hidden"
      >
        <ChevronDown
          className={cn("size-4 transition-transform", open && "rotate-180")}
          aria-hidden
        />
        More filters
      </button>
      <div
        id="more-filters"
        className={cn(
          "mt-4 gap-4 sm:grid-cols-2 lg:mt-0 lg:grid lg:grid-cols-1",
          open ? "grid" : "hidden",
        )}
      >
        {children}
      </div>
    </div>
  );
}
