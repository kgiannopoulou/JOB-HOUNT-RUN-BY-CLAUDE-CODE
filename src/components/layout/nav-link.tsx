"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { NavItem } from "@/config/navigation";
import { cn } from "@/lib/utils";

type NavLinkProps = {
  item: NavItem;
  /** Rail mode shows only the icon between the md and lg breakpoints. */
  rail?: boolean;
  onNavigate?: () => void;
};

export function NavLink({ item, rail = false, onNavigate }: NavLinkProps) {
  const pathname = usePathname();
  const isActive =
    pathname === item.href || pathname.startsWith(`${item.href}/`);
  const Icon = item.icon;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      aria-label={rail ? item.title : undefined}
      className={cn(
        "flex h-10 items-center gap-3 rounded-lg px-3 text-sm font-medium text-sidebar-foreground transition-colors outline-none",
        "hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        "focus-visible:ring-3 focus-visible:ring-sidebar-ring/50",
        isActive && "bg-sidebar-accent text-sidebar-accent-foreground",
        rail && "justify-center px-0 lg:justify-start lg:px-3",
      )}
    >
      <Icon className="size-[18px] shrink-0" aria-hidden />
      <span className={cn(rail && "hidden lg:inline")}>{item.title}</span>
    </Link>
  );

  if (!rail) return link;

  return (
    <Tooltip>
      <TooltipTrigger asChild>{link}</TooltipTrigger>
      <TooltipContent side="right" className="lg:hidden">
        {item.title}
      </TooltipContent>
    </Tooltip>
  );
}
