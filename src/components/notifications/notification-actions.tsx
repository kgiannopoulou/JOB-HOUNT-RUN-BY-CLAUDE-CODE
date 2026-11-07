"use client";

import { RefreshCw } from "lucide-react";

import { ActionButton } from "@/components/shared/action-button";
import { checkNotificationsNow, markAllNotificationsRead } from "@/server/notifications/actions";

export function CheckNowButton() {
  return (
    <ActionButton action={checkNotificationsNow} fields={{}} pendingLabel="Checking…" variant="outline">
      <RefreshCw data-icon="inline-start" /> Check now
    </ActionButton>
  );
}

export function MarkAllReadButton() {
  return (
    <ActionButton action={markAllNotificationsRead} fields={{}} pendingLabel="Saving…" variant="outline">
      Mark all as read
    </ActionButton>
  );
}
