"use client";

import { Logo } from "@/components/layout/logo";
import { NavLink } from "@/components/layout/nav-link";
import { primaryNav, secondaryNav } from "@/config/navigation";

export function AppSidebar() {
  return (
    <aside className="sticky top-0 hidden h-svh w-16 shrink-0 flex-col border-r bg-sidebar md:flex lg:w-60">
      <div className="flex h-16 items-center justify-center px-3 lg:justify-start lg:px-5">
        <Logo href="/dashboard" wordmarkClassName="hidden lg:inline" />
      </div>
      <nav
        aria-label="Main"
        className="flex flex-1 flex-col justify-between px-3 pb-4"
      >
        <ul className="space-y-1">
          {primaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} rail />
            </li>
          ))}
        </ul>
        <ul className="space-y-1">
          {secondaryNav.map((item) => (
            <li key={item.href}>
              <NavLink item={item} rail />
            </li>
          ))}
        </ul>
      </nav>
    </aside>
  );
}
