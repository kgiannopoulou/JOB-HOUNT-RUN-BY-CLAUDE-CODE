import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { MobileNav } from "@/components/layout/mobile-nav";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export function AppTopbar() {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-3 backdrop-blur md:px-8">
      <MobileNav />
      <Logo href="/dashboard" className="md:hidden" />
      <div className="ml-auto flex items-center gap-2">
        <Badge variant="secondary" className="hidden sm:inline-flex">
          Preview, no account connected
        </Badge>
        <ThemeToggle />
        <Button asChild variant="outline" size="lg">
          <Link href="/login">Sign in</Link>
        </Button>
      </div>
    </header>
  );
}
