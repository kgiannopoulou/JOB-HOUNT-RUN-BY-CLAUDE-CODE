import { CircleAlert, CircleCheck } from "lucide-react";

import type { ActionState } from "@/lib/action-state";
import { cn } from "@/lib/utils";

export function FormMessage({ state }: { state: ActionState }) {
  if (state.status === "idle") return null;
  const isError = state.status === "error";
  const Icon = isError ? CircleAlert : CircleCheck;

  return (
    <p
      role={isError ? "alert" : "status"}
      className={cn(
        "flex gap-2 rounded-lg p-3 text-sm",
        isError
          ? "bg-destructive/10 text-destructive"
          : "bg-accent text-accent-foreground",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      {state.message}
    </p>
  );
}
