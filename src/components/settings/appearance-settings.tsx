"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";

import { cn } from "@/lib/utils";

const themes = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const subscribe = () => () => {};

export function AppearanceSettings() {
  const { theme, setTheme } = useTheme();
  // The stored theme is only known in the browser, so nothing is selected on the server.
  const hydrated = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div role="group" aria-label="Theme" className="grid gap-3 sm:grid-cols-3">
      {themes.map(({ value, label, icon: Icon }) => {
        const selected = hydrated && theme === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={selected}
            onClick={() => setTheme(value)}
            className={cn(
              "flex items-center gap-3 rounded-lg border p-4 text-sm font-medium transition-colors outline-none",
              "hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50",
              selected && "border-primary bg-accent text-accent-foreground",
            )}
          >
            <Icon className="size-4" aria-hidden />
            {label}
          </button>
        );
      })}
    </div>
  );
}
