import Link from "next/link";

import { Logo } from "@/components/layout/logo";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main
      id="main"
      className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-20 text-center"
    >
      <Logo />
      <h1 className="text-2xl font-semibold tracking-tight">Page not found</h1>
      <p className="text-sm text-muted-foreground">
        This page does not exist or has moved.
      </p>
      <Button asChild size="lg">
        <Link href="/">Back to home</Link>
      </Button>
    </main>
  );
}
