import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/jobs", label: "Search" },
  { href: "/jobs/saved", label: "Saved jobs" },
];

export function JobsTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Jobs" className="flex gap-1 border-b">
      {tabs.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={tab.href === current ? "page" : undefined}
          className={cn(
            "-mb-px border-b-2 border-transparent px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground",
            tab.href === current && "border-primary text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
