import { Suspense } from "react";

import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { UserNav } from "@/components/layout/user-nav";
import { Skeleton } from "@/components/ui/skeleton";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:px-8">
      <MobileNav />
      <Logo href="/dashboard" className="md:hidden" />
      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Suspense fallback={<Skeleton className="size-9 rounded-full" />}>
          <UserNav />
        </Suspense>
      </div>
    </header>
  );
}
