"use client";

import { startTransition, useOptimistic, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";

import { selectClass } from "@/components/shared/form-fields";
import { Badge } from "@/components/ui/badge";
import { idleState } from "@/lib/action-state";
import { formatDay } from "@/lib/applications/schema";
import {
  allowedMoves,
  applicationStatuses,
  canMove,
  statusLabels,
  type ApplicationStatus,
} from "@/lib/applications/status";
import { cn } from "@/lib/utils";
import { moveApplication } from "@/server/applications/actions";

export type BoardCard = {
  id: string;
  company: string;
  role_title: string;
  status: ApplicationStatus;
  applied_at: string | null;
};

type Move = { id: string; to: ApplicationStatus };

export function Board({ applications }: { applications: BoardCard[] }) {
  const [cards, applyMove] = useOptimistic(applications, (current, { id, to }: Move) =>
    current.map((card) => (card.id === id ? { ...card, status: to } : card)),
  );
  const [dragged, setDragged] = useState<BoardCard | null>(null);

  // A failed move ends the transition, which puts the card back where it was.
  const move = (card: BoardCard, to: ApplicationStatus) => {
    if (card.status === to) return;
    startTransition(async () => {
      applyMove({ id: card.id, to });
      const formData = new FormData();
      formData.set("applicationId", card.id);
      formData.set("from", card.status);
      formData.set("to", to);
      const result = await moveApplication(idleState, formData);
      if (result.status === "error") toast.error(result.message);
    });
  };

  return (
    <div
      role="region"
      aria-label="Application board"
      tabIndex={0}
      className="-mx-4 overflow-x-auto px-4 pb-2 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:mx-0 md:px-0"
    >
      <ul className="flex min-w-max gap-3 xl:grid xl:min-w-0 xl:grid-cols-6">
        {applicationStatuses.map((status) => {
          const column = cards.filter((card) => card.status === status);
          const droppable = dragged !== null && canMove(dragged.status, status);
          return (
            <li
              key={status}
              data-testid={`column-${status}`}
              onDragOver={(event) => {
                if (droppable) event.preventDefault();
              }}
              onDrop={(event) => {
                event.preventDefault();
                if (dragged && droppable) move(dragged, status);
                setDragged(null);
              }}
              className={cn(
                "flex w-60 flex-col gap-2 rounded-xl bg-muted/60 p-3 xl:w-auto",
                droppable && "ring-2 ring-primary/50",
              )}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{statusLabels[status]}</h2>
                <Badge variant="secondary">{column.length}</Badge>
              </div>
              {column.length === 0 && (
                <p className="rounded-lg border border-dashed px-3 py-6 text-center text-xs text-muted-foreground">
                  No applications
                </p>
              )}
              <ul className="space-y-2">
                {column.map((card) => (
                  <li
                    key={card.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDragged(card);
                    }}
                    onDragEnd={() => setDragged(null)}
                    className="cursor-grab space-y-2 rounded-lg border bg-card p-3 text-sm shadow-xs active:cursor-grabbing"
                  >
                    <div className="min-w-0">
                      <Link
                        href={`/applications/${card.id}`}
                        className="block truncate font-medium hover:underline"
                      >
                        {card.role_title}
                      </Link>
                      <p className="truncate text-muted-foreground">{card.company}</p>
                      {card.applied_at && (
                        <p className="text-xs text-muted-foreground">
                          Applied {formatDay(card.applied_at)}
                        </p>
                      )}
                    </div>
                    {/* The way to move a card by keyboard or touch, where dragging is unavailable. */}
                    <select
                      aria-label={`Move ${card.role_title} at ${card.company}`}
                      value={card.status}
                      onChange={(event) => move(card, event.target.value as ApplicationStatus)}
                      className={cn(selectClass, "h-8 text-xs")}
                    >
                      <option value={card.status}>{statusLabels[card.status]}</option>
                      {allowedMoves[card.status].map((target) => (
                        <option key={target} value={target}>
                          Move to {statusLabels[target]}
                        </option>
                      ))}
                    </select>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
