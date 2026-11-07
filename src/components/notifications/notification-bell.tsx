import Link from "next/link";
import { Bell } from "lucide-react";

import { NotificationSync } from "@/components/notifications/notification-sync";
import { Button } from "@/components/ui/button";
import { createClient } from "@/server/supabase/server";

export async function NotificationBell() {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .is("read_at", null)
    .is("dismissed_at", null);
  const unread = count ?? 0;

  return (
    <>
      <NotificationSync />
      <Button asChild variant="ghost" size="icon" className="relative">
        <Link
          href="/notifications"
          aria-label={unread ? `Notifications, ${unread} unread` : "Notifications"}
        >
          <Bell aria-hidden />
          {unread > 0 && (
            <span
              aria-hidden
              className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-medium text-primary-foreground"
            >
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Link>
      </Button>
    </>
  );
}
