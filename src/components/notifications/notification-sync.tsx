"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

import { syncNotifications } from "@/server/notifications/actions";

/** Reports the browser's time zone and checks for new notifications once per load. */
export function NotificationSync() {
  const router = useRouter();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    syncNotifications(timeZone)
      .then((created) => {
        if (created > 0) router.refresh();
      })
      .catch(() => {
        // Notifications are not worth interrupting the page for.
      });
  }, [router]);

  return null;
}
