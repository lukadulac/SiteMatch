import type { UserRole } from "../auth/roles.js";

export type NavCounts = {
	unreadMessages: number;
	unreadNotifications: number;
	pendingServiceRequests: number;
};

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
