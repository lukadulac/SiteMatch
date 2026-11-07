import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/contracts/supabase";

type Result<T> =
	| { data: T; error?: never }
	| { data?: never; error: string };

/** Unread notifications for the header badge. Row level security limits it to the user's own. */
export async function getUnreadNotificationCount(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<Result<number>> {
	const { count, error } = await supabase
		.from("notifications")
		.select("id", { count: "exact", head: true })
		.eq("user_id", userId)
		.is("read_at", null);

	if (error) {
		return { error: error.message };
	}

	return { data: count ?? 0 };
}

export const NOTIFICATION_LIST_LIMIT = 50;

export type NotificationItem = Pick<
	Database["public"]["Tables"]["notifications"]["Row"],
	"id" | "type" | "entity_type" | "entity_id" | "title" | "read_at" | "created_at"
>;

/** Where a notification leads, by what it points at. */
export function getNotificationHref(
	notification: Pick<NotificationItem, "entity_type" | "entity_id">,
) {
	switch (notification.entity_type) {
		case "project":
			return `/oglasi/${notification.entity_id}`;
		case "application":
			return "/dashboard/provider/applications?status=closed";
		case "service_request":
			return `/dashboard/service-requests/${notification.entity_id}`;
		case "workroom":
			return `/dashboard/workrooms/${notification.entity_id}`;
	}
}

/** The user's most recent notifications, newest first. */
export async function getNotifications(
	supabase: SupabaseClient<Database>,
	userId: string,
	limit = NOTIFICATION_LIST_LIMIT,
): Promise<Result<NotificationItem[]>> {
	const { data, error } = await supabase
		.from("notifications")
		.select("id, type, entity_type, entity_id, title, read_at, created_at")
		.eq("user_id", userId)
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.limit(limit);

	if (error) {
		return { error: error.message };
	}

	return { data: data ?? [] };
}

/** Marks one notification read and returns it, so the caller can follow its link. */
export async function markNotificationRead(
	supabase: SupabaseClient<Database>,
	userId: string,
	notificationId: string,
): Promise<Result<NotificationItem | null>> {
	const { data: notification, error } = await supabase
		.from("notifications")
		.select("id, type, entity_type, entity_id, title, read_at, created_at")
		.eq("id", notificationId)
		.eq("user_id", userId)
		.maybeSingle();

	if (error) {
		return { error: error.message };
	}

	if (!notification || notification.read_at) {
		return { data: notification };
	}

	const { error: updateError } = await supabase
		.from("notifications")
		.update({ read_at: new Date().toISOString() })
		.eq("id", notificationId)
		.eq("user_id", userId)
		.is("read_at", null);

	if (updateError) {
		return { error: updateError.message };
	}

	return { data: notification };
}

export async function markAllNotificationsRead(
	supabase: SupabaseClient<Database>,
	userId: string,
): Promise<Result<null>> {
	const { error } = await supabase
		.from("notifications")
		.update({ read_at: new Date().toISOString() })
		.eq("user_id", userId)
		.is("read_at", null);

	if (error) {
		return { error: error.message };
	}

	return { data: null };
}
