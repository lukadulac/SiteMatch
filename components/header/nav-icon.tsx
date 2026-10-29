import {
	Briefcase,
	FolderKanban,
	Inbox,
	LayoutDashboard,
	MessageSquare,
	Package,
	ScrollText,
	Send,
	ShieldCheck,
	Store,
	UserRound,
	UserSearch,
	Users,
	type LucideIcon,
} from "lucide-react";
import type { NavIconName } from "@/lib/navigation/menu-items";

const icons: Record<NavIconName, LucideIcon> = {
	dashboard: LayoutDashboard,
	folder: FolderKanban,
	inbox: Inbox,
	users: Users,
	message: MessageSquare,
	send: Send,
	package: Package,
	profile: UserRound,
	shield: ShieldCheck,
	store: Store,
	audit: ScrollText,
	userSearch: UserSearch,
	briefcase: Briefcase,
};

export function NavIcon({ name, className }: { name: NavIconName; className?: string }) {
	const Icon = icons[name];
	return <Icon aria-hidden="true" strokeWidth={2} className={className} />;
}
