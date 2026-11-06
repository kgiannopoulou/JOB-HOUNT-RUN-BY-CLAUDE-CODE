"use client";

import { useState } from "react";
import { Menu } from "lucide-react";

import { Logo } from "@/components/layout/logo";
import { NavLink } from "@/components/layout/nav-link";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { primaryNav, secondaryNav } from "@/config/navigation";

export function MobileNav() {
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon-lg"
          className="md:hidden"
          aria-label="Open menu"
        >
          <Menu />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="w-72 bg-sidebar">
        <SheetHeader>
          <SheetTitle asChild>
            <div>
              <Logo href="/dashboard" />
            </div>
          </SheetTitle>
          <SheetDescription className="sr-only">
            Main navigation
          </SheetDescription>
        </SheetHeader>
        <nav
          aria-label="Mobile"
          className="flex flex-1 flex-col justify-between px-3 pb-6"
        >
          <ul className="space-y-1">
            {primaryNav.map((item) => (
              <li key={item.href}>
                <NavLink item={item} onNavigate={close} />
              </li>
            ))}
          </ul>
          <ul className="space-y-1">
            {secondaryNav.map((item) => (
              <li key={item.href}>
                <NavLink item={item} onNavigate={close} />
              </li>
            ))}
          </ul>
        </nav>
      </SheetContent>
    </Sheet>
  );
}
