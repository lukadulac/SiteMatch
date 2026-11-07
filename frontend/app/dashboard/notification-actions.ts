"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
	getNotificationHref,
	markAllNotificationsRead,
	markNotificationRead,
} from "@/lib/notifications/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const NOTIFICATIONS_PATH = "/dashboard/notifications";

function noticeHref(key: "notificationError" | "notificationStatus", message: string) {
	return `${NOTIFICATIONS_PATH}?${key}=${encodeURIComponent(message)}`;
}

async function requireUser() {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	return { supabase, user };
}

/** Marks the notification read and goes to what it is about. */
export async function openNotificationAction(notificationId: string) {
	const { supabase, user } = await requireUser();
	const result = await markNotificationRead(supabase, user.id, notificationId);

	if (result.error) {
		redirect(noticeHref("notificationError", result.error));
	}

	if (!result.data) {
		redirect(noticeHref("notificationError", "Notification not found."));
	}

	// The header badge lives in the root layout.
	revalidatePath("/", "layout");
	redirect(getNotificationHref(result.data));
}

export async function markAllNotificationsReadAction() {
	const { supabase, user } = await requireUser();
	const result = await markAllNotificationsRead(supabase, user.id);

	if (result.error) {
		redirect(noticeHref("notificationError", result.error));
	}

	revalidatePath("/", "layout");
	redirect(noticeHref("notificationStatus", "All notifications marked read."));
}
