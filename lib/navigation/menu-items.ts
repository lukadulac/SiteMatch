import type { UserRole } from "@/lib/auth/roles";

/** Icon keys, mapped to lucide components by `components/header/nav-icon.tsx`. */
export type NavIconName =
	| "dashboard"
	| "folder"
	| "inbox"
	| "users"
	| "message"
	| "send"
	| "package"
	| "profile"
	| "shield"
	| "store"
	| "audit"
	| "userSearch"
	| "briefcase";

export type NavCountKind = "unread" | "pending";

export type NavCounts = {
	unreadMessages: number;
	pendingServiceRequests: number;
};

export type DashboardNavItem = {
	href: string;
	label: string;
	icon?: NavIconName;
	count?: number;
	countKind?: NavCountKind;
	active?: boolean;
};

type NavConfigItem = {
	href: string;
	label: string;
	icon: NavIconName;
	/** Other route prefixes that belong to this section, such as shared detail pages. */
	alsoMatches?: string[];
	countFrom?: keyof NavCounts;
	countKind?: NavCountKind;
	/** The drawer's profile card already links here, so the drawer leaves it out. */
	sidebarOnly?: boolean;
};

const roleNavigation: Record<UserRole, NavConfigItem[]> = {
	client: [
		{ href: "/dashboard/client", label: "Overview", icon: "dashboard" },
		{ href: "/dashboard/client/projects", label: "Projects", icon: "folder" },
		{
			href: "/dashboard/client/service-requests",
			label: "Service requests",
			icon: "inbox",
			alsoMatches: ["/dashboard/service-requests"],
		},
		{
			href: "/dashboard/client/workrooms",
			label: "Workrooms",
			icon: "users",
			alsoMatches: ["/dashboard/workrooms"],
		},
		{
			href: "/dashboard/messages",
			label: "Messages",
			icon: "message",
			countFrom: "unreadMessages",
			countKind: "unread",
		},
		{ href: "/dashboard/client/profile", label: "Profile", icon: "profile", sidebarOnly: true },
	],
	provider: [
		{ href: "/dashboard/provider", label: "Overview", icon: "dashboard" },
		{ href: "/dashboard/provider/applications", label: "Applications", icon: "send" },
		{ href: "/dashboard/provider/services", label: "Services", icon: "package" },
		{
			href: "/dashboard/provider/service-requests",
			label: "Service requests",
			icon: "inbox",
			alsoMatches: ["/dashboard/service-requests"],
			countFrom: "pendingServiceRequests",
			countKind: "pending",
		},
		{
			href: "/dashboard/provider/workrooms",
			label: "Workrooms",
			icon: "users",
			alsoMatches: ["/dashboard/workrooms"],
		},
		{
			href: "/dashboard/messages",
			label: "Messages",
			icon: "message",
			countFrom: "unreadMessages",
			countKind: "unread",
		},
		{ href: "/dashboard/provider/profile", label: "Profile", icon: "profile", sidebarOnly: true },
	],
	admin: [
		{ href: "/dashboard/admin", label: "Overview", icon: "dashboard" },
		{ href: "/dashboard/admin/users", label: "Users", icon: "users" },
		{ href: "/dashboard/admin/services", label: "Service listings", icon: "store" },
		{ href: "/dashboard/admin/projects", label: "Projects", icon: "folder" },
		{ href: "/dashboard/admin/audit", label: "Audit log", icon: "audit" },
	],
};

const browseNavigation: Array<NavConfigItem & { description: string }> = [
	{
		href: "/find-talent",
		label: "Find talent",
		icon: "userSearch",
		description: "Freelancers and agencies",
	},
	{
		href: "/jobs",
		label: "Find work",
		icon: "briefcase",
		description: "Projects from small businesses",
	},
];

function matchesPrefix(pathname: string, prefix: string) {
	return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * Returns the href of the item the pathname belongs to. The longest matching prefix
 * wins, so `/dashboard/client/projects` marks Projects and not Overview.
 */
export function findActiveHref(
	items: Array<Pick<NavConfigItem, "href" | "alsoMatches">>,
	pathname: string,
) {
	let best: { href: string; length: number } | null = null;

	for (const item of items) {
		for (const prefix of [item.href, ...(item.alsoMatches ?? [])]) {
			if (matchesPrefix(pathname, prefix) && (!best || prefix.length > best.length)) {
				best = { href: item.href, length: prefix.length };
			}
		}
	}

	return best?.href ?? null;
}

export type MenuItem = {
	href: string;
	label: string;
	icon: NavIconName;
	description?: string;
	active: boolean;
	count?: number;
	countKind?: NavCountKind;
};

export function getBrowseItems(pathname: string): MenuItem[] {
	const activeHref = findActiveHref(browseNavigation, pathname);

	return browseNavigation.map(({ href, label, icon, description }) => ({
		href,
		label,
		icon,
		description,
		active: href === activeHref,
	}));
}

export function getWorkspaceItems(
	role: UserRole,
	pathname: string,
	counts: NavCounts,
): MenuItem[] {
	const config = roleNavigation[role].filter((item) => !item.sidebarOnly);
	const activeHref = findActiveHref(config, pathname);

	return config.map(({ href, label, icon, countFrom, countKind }) => {
		const count = countFrom ? counts[countFrom] : 0;

		return {
			href,
			label,
			icon,
			active: href === activeHref,
			...(count > 0 ? { count, countKind } : {}),
		};
	});
}

export function getWorkspaceLabel(role: UserRole) {
	return role === "admin" ? "Admin" : "Your workspace";
}

/** The admin sidebar, with the active item taken from the pathname. */
export function getAdminNavigation(pathname: string): DashboardNavItem[] {
	const config = roleNavigation.admin;
	const activeHref = findActiveHref(config, pathname);

	return config.map(({ href, label, icon }) => ({ href, label, icon, active: href === activeHref }));
}

/**
 * Pages pass the items they know about (active state, counts); this fills in the rest
 * of the role's sections so every section stays reachable from any dashboard page.
 */
export function completeDashboardNavigation(items: DashboardNavItem[]): DashboardNavItem[] {
	const role = items[0]?.href === "/dashboard/client"
		? "client"
		: items[0]?.href === "/dashboard/provider"
			? "provider"
			: null;

	if (!role) {
		return items;
	}

	// Pages only decide active state and counts; labels and icons come from the config
	// so every page shows the same menu.
	const overrides = new Map(items.map((item) => [item.href, item]));
	return roleNavigation[role].map(({ href, label, icon, countKind }) => {
		const override = overrides.get(href);

		return {
			href,
			label,
			icon,
			countKind,
			active: override?.active,
			count: override?.count,
		};
	});
}
