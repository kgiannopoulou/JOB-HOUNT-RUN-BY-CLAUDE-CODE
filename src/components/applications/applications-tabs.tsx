import Link from "next/link";

import { cn } from "@/lib/utils";

const tabs = [
  { href: "/applications", label: "Board" },
  { href: "/applications/list", label: "List" },
  { href: "/applications/calendar", label: "Calendar" },
  { href: "/applications/stats", label: "Statistics" },
];

export function ApplicationsTabs({ current }: { current: string }) {
  return (
    <nav aria-label="Applications" className="flex gap-1 overflow-x-auto border-b">
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
