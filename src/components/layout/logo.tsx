import Link from "next/link";
import { Target } from "lucide-react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

type LogoProps = {
  href?: string;
  className?: string;
  /** Hide the wordmark, for example in the collapsed sidebar. */
  markOnly?: boolean;
  /** Tailwind classes that control wordmark visibility at breakpoints. */
  wordmarkClassName?: string;
};

export function Logo({
  href = "/",
  className,
  markOnly = false,
  wordmarkClassName,
}: LogoProps) {
  return (
    <Link
      href={href}
      aria-label={`${siteConfig.name} home`}
      className={cn(
        "inline-flex items-center gap-2 rounded-md font-semibold tracking-tight",
        className,
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Target className="size-5" aria-hidden />
      </span>
      {!markOnly && (
        <span className={cn("text-base", wordmarkClassName)}>
          {siteConfig.name}
        </span>
      )}
    </Link>
  );
}
