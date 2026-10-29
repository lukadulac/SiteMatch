import Link from "next/link";
import type { NavCountKind, NavIconName } from "@/lib/navigation/menu-items";
import { NavIcon } from "./nav-icon";

// One row style for the mobile drawer, the dashboard sidebar and the admin sidebar.
// Violet marks where you are (fill, bar, icon tint, weight); hover and press stay neutral.
const focusRing =
	"focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2";

function rowTone(active: boolean) {
	return active
		? "bg-violet-50 font-semibold"
		: "font-medium hover:bg-zinc-100 active:bg-zinc-200";
}

function ActiveBar({ className }: { className: string }) {
	return (
		<span
			aria-hidden="true"
			className={`absolute left-0 w-[3px] rounded-r-[3px] bg-violet-600 ${className}`}
		/>
	);
}

type CountBadgeProps = {
	count: number;
	kind?: NavCountKind;
};

/** The number is decorative; screen readers hear ", 3 unread" as part of the link name. */
export function CountBadge({ count, kind }: CountBadgeProps) {
	const tone =
		kind === "unread"
			? "bg-violet-600 text-white"
			: kind === "pending"
				? "bg-white text-[#111] ring-1 ring-inset ring-black/[.18]"
				: "bg-zinc-100 text-[#111]";

	return (
		<>
			<span
				aria-hidden="true"
				className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-xs font-semibold tabular-nums ${tone}`}
			>
				{count}
			</span>
			<span className="sr-only">{kind ? `, ${count} ${kind}` : `, ${count}`}</span>
		</>
	);
}

type WorkspaceRowProps = {
	href: string;
	label: string;
	icon?: NavIconName;
	active?: boolean;
	count?: number;
	countKind?: NavCountKind;
	/** 40px rows with 14px text for the desktop sidebar; the drawer uses 44px / 15px. */
	dense?: boolean;
	onNavigate?: () => void;
	className?: string;
};

export function WorkspaceRow({
	href,
	label,
	icon,
	active = false,
	count,
	countKind,
	dense = false,
	onNavigate,
	className = "",
}: WorkspaceRowProps) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			aria-current={active ? "page" : undefined}
			className={`relative flex items-center gap-3 rounded-lg px-3 text-[#111] transition-colors ${
				dense ? "min-h-10 text-sm" : "min-h-11 text-[15px] leading-5"
			} ${rowTone(active)} ${focusRing} ${className}`}
		>
			{active ? <ActiveBar className="inset-y-2.5" /> : null}
			{icon ? (
				<NavIcon
					name={icon}
					className={`shrink-0 ${dense ? "size-[18px]" : "size-5"} ${
						active ? "text-violet-700" : "text-zinc-600"
					}`}
				/>
			) : null}
			<span className="flex-1 whitespace-nowrap">{label}</span>
			{count ? <CountBadge count={count} kind={countKind} /> : null}
		</Link>
	);
}

type BrowseRowProps = {
	href: string;
	label: string;
	icon: NavIconName;
	description?: string;
	active?: boolean;
	onNavigate?: () => void;
};

export function BrowseRow({
	href,
	label,
	icon,
	description,
	active = false,
	onNavigate,
}: BrowseRowProps) {
	return (
		<Link
			href={href}
			onClick={onNavigate}
			aria-current={active ? "page" : undefined}
			className={`relative flex min-h-14 items-center gap-3 rounded-lg px-3 py-2 text-[#111] transition-colors ${rowTone(active)} ${focusRing}`}
		>
			{active ? <ActiveBar className="inset-y-3" /> : null}
			<span
				aria-hidden="true"
				className={`grid size-9 shrink-0 place-items-center rounded-lg ${
					active ? "bg-violet-100 text-violet-700" : "bg-zinc-100 text-zinc-600"
				}`}
			>
				<NavIcon name={icon} className="size-5" />
			</span>
			<span className="flex min-w-0 flex-col">
				<span className="text-[15px] leading-5">{label}</span>
				{description ? (
					<span className="text-[13px] leading-[18px] font-normal text-zinc-600">{description}</span>
				) : null}
			</span>
		</Link>
	);
}
