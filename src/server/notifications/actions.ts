"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { errorState, successState, type ActionState } from "@/lib/action-state";
import { isValidTimeZone } from "@/lib/time";
import { getCurrentUser } from "@/server/auth/user";
import { deliverNotifications } from "@/server/notifications/deliver";
import { createClient } from "@/server/supabase/server";

const CHECK_INTERVAL_MS = 15 * 60 * 1000;

const uuid = z.uuid();

async function signedInUser() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/notifications");
  return user;
}

function refresh() {
  // The unread count is in the layout, so every page needs it.
  revalidatePath("/", "layout");
}

/**
 * Runs when the signed-in app loads. Learns the user's time zone from the browser
 * the first time, then works out notifications at most every 15 minutes.
 */
export async function syncNotifications(browserTimeZone: string): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;

  const supabase = await createClient();
  const { data } = await supabase
    .from("user_preferences")
    .select("timezone, notifications_checked_at")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!data) return 0;

  if (!data.timezone && isValidTimeZone(browserTimeZone)) {
    await supabase
      .from("user_preferences")
      .update({ timezone: browserTimeZone })
      .eq("user_id", user.id);
  }

  const last = data.notifications_checked_at;
  if (last && Date.now() - new Date(last).getTime() < CHECK_INTERVAL_MS) return 0;

  try {
    const created = await deliverNotifications(user.id);
    if (created > 0) refresh();
    return created;
  } catch {
    console.error("Notification check failed");
    return 0;
  }
}

export async function checkNotificationsNow(): Promise<ActionState> {
  const user = await signedInUser();
  try {
    const created = await deliverNotifications(user.id);
    refresh();
    return successState(created ? `${created} new.` : "Nothing new.");
  } catch {
    console.error("Notification check failed");
    return errorState("Notifications could not be checked. Please try again.");
  }
}

export async function markNotificationRead(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await signedInUser();
  const id = uuid.safeParse(formData.get("notificationId"));
  if (!id.success) return errorState("This notification could not be found.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .eq("id", id.data);
  if (error) return errorState("This notification could not be updated.");

  refresh();
  return successState("Marked as read.");
}

export async function markAllNotificationsRead(): Promise<ActionState> {
  await signedInUser();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ read_at: new Date().toISOString() })
    .is("read_at", null);
  if (error) return errorState("Notifications could not be updated.");

  refresh();
  return successState("All marked as read.");
}

/** Hides a notification. The row stays, or the same event would notify again. */
export async function dismissNotification(
  _: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await signedInUser();
  const id = uuid.safeParse(formData.get("notificationId"));
  if (!id.success) return errorState("This notification could not be found.");

  const now = new Date().toISOString();
  const supabase = await createClient();
  const { error } = await supabase
    .from("notifications")
    .update({ dismissed_at: now, read_at: now })
    .eq("id", id.data);
  if (error) return errorState("This notification could not be dismissed.");

  refresh();
  return successState("Dismissed.");
}
