import type { SupabaseClient } from "@supabase/supabase-js";
import { getDashboardPath, isAppRole, type UserRole } from "@/lib/auth/roles";
import { getUnreadConversationCount } from "@/lib/messaging/service";
import type { NavCounts } from "@/lib/navigation/menu-items";
import type { Database } from "@/types/supabase";

export type HeaderCta = {
	href: string;
	label: string;
	icon: "plus" | "shield";
};

export type HeaderUser = {
	/** Null when neither the profile nor the auth metadata carries a known role. */
	role: UserRole | null;
	name: string;
	/** profiles.avatar_url; null shows initials. */
	avatarPath: string | null;
	emailVerified: boolean;
	dashboardHref: string;
	profileHref: string;
	cta: HeaderCta | null;
	counts: NavCounts;
};

export type HeaderState = { user: HeaderUser | null };

const NO_COUNTS: NavCounts = { unreadMessages: 0, pendingServiceRequests: 0 };

const roleCtas: Record<UserRole, HeaderCta> = {
	client: { href: "/oglasi/novi", label: "Post a project", icon: "plus" },
	provider: { href: "/dashboard/provider/services/post", label: "Publish a service", icon: "plus" },
	admin: { href: "/dashboard/admin", label: "Open admin dashboard", icon: "shield" },
};

async function loadCounts(
	supabase: SupabaseClient<Database>,
	userId: string,
	role: UserRole,
): Promise<NavCounts> {
	if (role === "admin") {
		return NO_COUNTS;
	}

	// A failed count hides its badge; it never takes the header down.
	const [unread, pending] = await Promise.all([
		getUnreadConversationCount(supabase, userId),
		role === "provider"
			? supabase
				.from("provider_service_requests")
				.select("id", { count: "exact", head: true })
				.eq("provider_id", userId)
				.eq("status", "pending")
			: null,
	]);

	return {
		unreadMessages: unread.data ?? 0,
		pendingServiceRequests: pending && !pending.error ? pending.count ?? 0 : 0,
	};
}

export async function getHeaderState(supabase: SupabaseClient<Database>): Promise<HeaderState> {
	const {
		data: { user },
	} = await supabase.auth.getUser();

	if (!user) {
		return { user: null };
	}

	const { data: profile } = await supabase
		.from("profiles")
		.select("role, full_name, avatar_url")
		.eq("id", user.id)
		.maybeSingle();

	const metadataRole =
		user.user_metadata && typeof user.user_metadata === "object"
			? user.user_metadata.role
			: null;
	const role = isAppRole(profile?.role) ? profile.role : isAppRole(metadataRole) ? metadataRole : null;
	const name = profile?.full_name?.trim() || user.email?.split("@")[0] || "Your account";
	const dashboardHref = role ? getDashboardPath(role) : "/dashboard";

	return {
		user: {
			role,
			name,
			avatarPath: profile?.avatar_url ?? null,
			emailVerified: Boolean(user.email_confirmed_at),
			dashboardHref,
			profileHref: role === "client" || role === "provider" ? `${dashboardHref}/profile` : dashboardHref,
			cta: role ? roleCtas[role] : null,
			counts: role ? await loadCounts(supabase, user.id, role) : NO_COUNTS,
		},
	};
}
