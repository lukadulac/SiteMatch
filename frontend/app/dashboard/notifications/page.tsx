import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
	markAllNotificationsReadAction,
	openNotificationAction,
} from "@/app/dashboard/notification-actions";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/contracts/auth/roles";
import { getUnreadConversationCount } from "@/lib/messaging/service";
import {
	getNotifications,
	NOTIFICATION_LIST_LIMIT,
	type NotificationItem,
} from "@/lib/notifications/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type NotificationsPageProps = {
	searchParams?: Promise<{
		notificationError?: string | string[];
		notificationStatus?: string | string[];
	}>;
};

function formatNotificationTime(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		hour: "numeric",
		minute: "2-digit",
	}).format(new Date(value));
}

function NotificationRow({ notification }: { notification: NotificationItem }) {
	const unread = !notification.read_at;

	return (
		<li>
			<form action={openNotificationAction.bind(null, notification.id)}>
				<button
					type="submit"
					className={`flex w-full min-w-0 items-start gap-3 rounded-2xl border px-4 py-3.5 text-left transition hover:border-line-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 sm:px-5 ${
						unread ? "border-violet-200 bg-violet-50/60" : "border-line bg-white"
					}`}
				>
					<span
						aria-hidden="true"
						className={`mt-1.5 size-2 shrink-0 rounded-full ${unread ? "bg-violet-600" : "bg-transparent"}`}
					/>
					<span className="min-w-0 flex-1">
						<span
							className={`block text-[0.9375rem] leading-snug wrap-break-word ${
								unread ? "font-semibold text-foreground" : "text-secondary"
							}`}
						>
							{notification.title}
							{unread ? <span className="sr-only"> (unread)</span> : null}
						</span>
						<span className="mt-1 block text-[0.8125rem] text-secondary">
							{formatNotificationTime(notification.created_at)}
						</span>
					</span>
				</button>
			</form>
		</li>
	);
}

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
	const query = await searchParams;
	const notificationError =
		typeof query?.notificationError === "string" ? query.notificationError : null;
	const notificationStatus =
		typeof query?.notificationStatus === "string" ? query.notificationStatus : null;
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		redirect("/login");
	}

	const provisioned = await ensureUserProfile(supabase, user);

	if (!provisioned.role) {
		await supabase.auth.signOut();
		redirect("/login");
	}

	if (provisioned.role !== "client" && provisioned.role !== "provider") {
		redirect(getDashboardPath(provisioned.role));
	}

	const [notificationsResult, unreadMessagesResult] = await Promise.all([
		getNotifications(supabase, user.id),
		getUnreadConversationCount(supabase, user.id),
	]);

	if (notificationsResult.error) {
		throw new Error(notificationsResult.error);
	}

	const notifications = notificationsResult.data ?? [];
	const unreadCount = notifications.filter((notification) => !notification.read_at).length;

	return (
		<DashboardShell
			title="Notifications"
			subtitle="New applications, hires, requests and completed work. Open one to go to it."
			navItems={[
				{ href: getDashboardPath(provisioned.role), label: "Overview" },
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadMessagesResult.data ?? 0,
				},
				{
					href: "/dashboard/notifications",
					label: "Notifications",
					active: true,
					count: unreadCount,
				},
			]}
		>
			{notificationError ? (
				<div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
					{notificationError}
				</div>
			) : null}

			{notificationStatus ? (
				<div role="status" className="rounded-2xl border border-green-200 bg-green-50 p-4 text-sm font-semibold text-green-700">
					{notificationStatus}
				</div>
			) : null}

			<section aria-labelledby="notifications-heading" className="space-y-4">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 id="notifications-heading" className="text-lg font-semibold">
						{unreadCount > 0 ? `${unreadCount} unread` : "All caught up"}
					</h2>
					{unreadCount > 0 ? (
						<form action={markAllNotificationsReadAction}>
							<button
								type="submit"
								className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold transition hover:bg-black/3"
							>
								Mark all read
							</button>
						</form>
					) : null}
				</div>

				{notifications.length > 0 ? (
					<ul className="space-y-2">
						{notifications.map((notification) => (
							<NotificationRow key={notification.id} notification={notification} />
						))}
					</ul>
				) : (
					<div className="rounded-3xl border border-dashed border-line-strong bg-white p-8 text-center text-sm text-secondary">
						Nothing yet. You will see new applications, hires and completed work here.
					</div>
				)}

				{notifications.length === NOTIFICATION_LIST_LIMIT ? (
					<p className="text-[0.8125rem] text-secondary">
						Showing the {NOTIFICATION_LIST_LIMIT} most recent notifications.
					</p>
				) : null}
			</section>
		</DashboardShell>
	);
}
