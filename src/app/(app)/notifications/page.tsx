import type { Metadata } from "next";
import Link from "next/link";
import { Bell, Check, X } from "lucide-react";

import { CheckNowButton, MarkAllReadButton } from "@/components/notifications/notification-actions";
import { ActionButton } from "@/components/shared/action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDay } from "@/lib/applications/schema";
import { typeLabels, type NotificationType } from "@/lib/notifications/rules";
import { dateInZone } from "@/lib/time";
import { requireUser } from "@/server/auth/user";
import { dismissNotification, markNotificationRead } from "@/server/notifications/actions";
import { createClient } from "@/server/supabase/server";
import { getUserClock } from "@/server/time";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  await requireUser("/notifications");

  const supabase = await createClient();
  const [clock, { data, error }] = await Promise.all([
    getUserClock(),
    supabase
      .from("notifications")
      .select("id, type, title, body, link, read_at, created_at")
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(100),
  ]);
  if (error) throw new Error(`Notification list failed: ${error.code}`);
  const unread = data.filter((item) => !item.read_at).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description="Shown here in the app. Choose what you hear about in Settings."
      >
        <Button asChild variant="outline" size="lg">
          <Link href="/settings">Preferences</Link>
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-start gap-2">
        <CheckNowButton />
        {unread > 0 && <MarkAllReadButton />}
      </div>

      {data.length === 0 ? (
        <EmptyState
          icon={Bell}
          title="No notifications"
          description="Reminders, upcoming interviews and new jobs that fit your target titles appear here."
        />
      ) : (
        <ul aria-label="Notifications" className="divide-y rounded-xl border">
          {data.map((item) => (
            <li key={item.id} className="flex items-start gap-3 p-3">
              <div className="min-w-0 flex-1 space-y-0.5">
                <p className="flex flex-wrap items-center gap-2">
                  <Badge variant={item.read_at ? "outline" : "default"}>
                    {typeLabels[item.type as NotificationType] ?? item.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {formatDay(dateInZone(new Date(item.created_at), clock.timeZone))}
                  </span>
                </p>
                {item.link ? (
                  <Link href={item.link} className="block break-words text-sm font-medium hover:underline">
                    {item.title}
                  </Link>
                ) : (
                  <p className="break-words text-sm font-medium">{item.title}</p>
                )}
                <p className="break-words text-sm text-muted-foreground">{item.body}</p>
              </div>
              <div className="flex shrink-0 gap-1">
                {!item.read_at && (
                  <ActionButton
                    action={markNotificationRead}
                    fields={{ notificationId: item.id }}
                    pendingLabel="…"
                    variant="outline"
                  >
                    <Check aria-hidden />
                    <span className="sr-only">Mark as read: {item.title}</span>
                  </ActionButton>
                )}
                <ActionButton
                  action={dismissNotification}
                  fields={{ notificationId: item.id }}
                  pendingLabel="…"
                  variant="outline"
                >
                  <X aria-hidden />
                  <span className="sr-only">Dismiss: {item.title}</span>
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
