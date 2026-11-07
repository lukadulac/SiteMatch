import Link from "next/link";
import type { ReactNode } from "react";
import { Avatar } from "@/components/profile/avatar";
import { OverviewGreeting } from "@/components/dashboard/overview/overview-greeting";

export function formatTimeAgo(value: string) {
	const diffMs = Date.now() - new Date(value).getTime();
	const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

	if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	}

	const diffDays = Math.floor(diffHours / 24);
	return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

export function formatShortDate(value: string) {
	return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(
		new Date(value),
	);
}

/** Names for a "Needs you" subline: "Ana", "Ana and Ivo", "Ana, Ivo and Lea". */
export function joinNames(names: string[]) {
	if (names.length <= 1) return names[0] ?? "";
	return `${names.slice(0, -1).join(", ")} and ${names[names.length - 1]}`;
}

export type ChipTone = "neutral" | "green" | "blue" | "violet" | "amber" | "red";

const chipTones: Record<ChipTone, string> = {
	neutral: "bg-zinc-100 text-zinc-700",
	green: "bg-green-100 text-green-800",
	blue: "bg-blue-100 text-blue-800",
	violet: "bg-violet-100 text-violet-800",
	amber: "bg-amber-100 text-amber-800",
	red: "bg-red-100 text-red-800",
};

export function StatusChip({ label, tone }: { label: string; tone: ChipTone }) {
	return (
		<span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${chipTones[tone]}`}>
			{label}
		</span>
	);
}

const icons = {
	search: "M10.5 17a6.5 6.5 0 1 0 0-13 6.5 6.5 0 0 0 0 13zM20 20l-4.8-4.8",
	plus: "M12 5v14M5 12h14",
	message: "M4 5h16v11H8l-4 4V5z",
	profile: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 20c1.5-3.5 4.5-5 8-5s6.5 1.5 8 5",
	proposals: "M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6",
	check: "M5 12.5l4.5 4.5L19 7.5",
	chevron: "M9 18l6-6-6-6",
};

export type OverviewIcon = keyof typeof icons;

function Icon({ name, className }: { name: OverviewIcon; className: string }) {
	return (
		<svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
			<path d={icons[name]} />
		</svg>
	);
}

/** The same gradient as the header's Profile button (theme/header-theme.ts). */
const brandButtonClasses =
	"bg-linear-to-r from-violet-500 to-pink-500 text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500";

export function OverviewHeader({
	name,
	avatarPath,
	action,
}: {
	name: string;
	avatarPath: string | null;
	action: { href: string; label: string; icon: OverviewIcon };
}) {
	return (
		<header className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
			<div className="flex min-w-0 items-center gap-3 sm:gap-4">
				<Avatar name={name} avatarPath={avatarPath} size="lg" className="sm:size-13 sm:text-base" />
				<OverviewGreeting firstName={name.split(" ")[0] || name} />
			</div>
			<Link
				href={action.href}
				className={`inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-full px-6 text-base font-semibold transition hover:opacity-90 ${brandButtonClasses}`}
			>
				<Icon name={action.icon} className="size-4.5" />
				{action.label}
			</Link>
		</header>
	);
}

export type NeedsItem = {
	id: string;
	title: string;
	detail: string;
	actionLabel: string;
	href: string;
	/** A person's avatar for a request, otherwise an icon for the kind of task. */
	person?: { name: string; avatarPath: string | null };
	icon?: OverviewIcon;
};

/** The day's to-do list. The first item gets the filled button; the rest are outlined. */
export function NeedsYouCard({ items, caughtUpText }: { items: NeedsItem[]; caughtUpText: string }) {
	return (
		<section
			aria-labelledby="needs-heading"
			className="relative overflow-hidden rounded-3xl border border-line bg-white px-4.5 pt-4.5 pb-1.5 sm:px-6 sm:pt-5.5 sm:pb-2"
		>
			<span aria-hidden="true" className="absolute inset-x-0 top-0 h-0.75 bg-linear-to-r from-violet-500 to-pink-500" />
			<div className="flex items-center gap-2 sm:gap-2.5">
				<h2 id="needs-heading" className="text-lg font-semibold sm:text-xl">
					Needs you
				</h2>
				{items.length > 0 ? (
					<span className={`flex h-6 min-w-6 items-center justify-center rounded-full px-2 text-xs font-bold ${brandButtonClasses}`}>
						<span className="sr-only">{items.length} items</span>
						<span aria-hidden="true">{items.length}</span>
					</span>
				) : null}
			</div>

			{items.length > 0 ? (
				<ol className="mt-2 sm:mt-3">
					{items.map((item, index) => (
						<li
							key={item.id}
							className="border-t border-black/6 py-3 sm:flex sm:flex-wrap sm:items-center sm:gap-3.5 sm:py-3.5"
						>
							<div className="flex items-start gap-2.5 sm:min-w-0 sm:flex-[1_1_16rem] sm:items-center sm:gap-3.5">
								<span className="w-4 shrink-0 pt-px text-center text-[0.8125rem] font-semibold text-secondary sm:w-4.5 sm:pt-0">
									{index + 1}
								</span>
								<span className="hidden sm:block">
									{item.person ? (
										<Avatar name={item.person.name} avatarPath={item.person.avatarPath} size="md" />
									) : (
										<span className="flex size-10 items-center justify-center rounded-full bg-background">
											<Icon name={item.icon ?? "check"} className="size-4.5" />
										</span>
									)}
								</span>
								<div className="min-w-0 flex-1">
									<p className="text-[0.9375rem] font-semibold wrap-break-word">{item.title}</p>
									<p className="mt-0.5 text-[0.8125rem] text-secondary sm:text-sm">{item.detail}</p>
								</div>
							</div>
							<Link
								href={item.href}
								className={`mt-2.5 ml-6.5 flex min-h-11 items-center justify-center rounded-2xl border px-4.5 text-sm font-semibold whitespace-nowrap transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-purple-500 sm:mt-0 sm:ml-0 ${
									index === 0
										? "border-black bg-black text-white hover:bg-zinc-800"
										: "border-black/14 bg-white text-foreground hover:bg-black/3"
								}`}
							>
								{item.actionLabel}
							</Link>
						</li>
					))}
				</ol>
			) : (
				<div className="flex items-center gap-3.5 pt-4 pb-4.5">
					<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700">
						<Icon name="check" className="size-4.5" />
					</span>
					<div>
						<p className="text-base font-semibold">You&apos;re all caught up</p>
						<p className="mt-0.5 text-sm text-secondary">{caughtUpText}</p>
					</div>
				</div>
			)}
		</section>
	);
}

/** Every number links to its list. A sideways scroller on phones, a grid from sm up. */
export function StatLinks({ stats }: { stats: Array<{ label: string; value: number; href: string }> }) {
	const columns = stats.length === 4 ? "sm:grid-cols-4" : "sm:grid-cols-3";

	return (
		<nav aria-label="Your numbers" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:overflow-visible sm:px-0">
			<ul className={`flex gap-2.5 sm:grid sm:gap-3 ${columns}`}>
				{stats.map((stat) => (
					<li key={stat.label} className="w-32 shrink-0 sm:w-auto">
						<Link
							href={stat.href}
							className="brand-hover-border flex h-full items-center justify-between gap-2 rounded-[1.25rem] border border-line bg-white px-4 py-3.5 sm:rounded-3xl sm:px-4.5 sm:py-4"
						>
							<span>
								<span className="block text-2xl font-bold tracking-[-0.01em] sm:text-[1.625rem]">{stat.value}</span>
								<span className="mt-0.5 block text-[0.8125rem] text-secondary sm:text-sm">{stat.label}</span>
							</span>
							<Icon name="chevron" className="hidden size-4 shrink-0 text-secondary sm:block" />
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

export function OverviewPanel({
	id,
	title,
	viewAllHref,
	children,
}: {
	id: string;
	title: string;
	viewAllHref?: string;
	children: ReactNode;
}) {
	return (
		<section aria-labelledby={id} className="min-w-0 rounded-3xl border border-line bg-white px-4.5 pt-4.5 pb-2 sm:px-5.5 sm:pt-5 sm:pb-2.5">
			<div className="flex items-center justify-between gap-3">
				<h2 id={id} className="text-[1.0625rem] font-semibold sm:text-lg">
					{title}
				</h2>
				{viewAllHref ? (
					<Link href={viewAllHref} className="brand-underline inline-block py-3 text-sm leading-5 font-semibold">
						View all
					</Link>
				) : null}
			</div>
			{children}
		</section>
	);
}

export function OverviewRows({ children }: { children: ReactNode }) {
	return <ul className="mt-1 sm:mt-2">{children}</ul>;
}

/** A linked row: separated by lines on phones, a soft hover tile from sm up. */
export function OverviewRow({
	href,
	title,
	detail,
	chip,
	person,
	aside,
}: {
	href: string;
	title: string;
	detail?: ReactNode;
	chip?: ReactNode;
	person?: { name: string; avatarPath: string | null };
	/** Shown at the top right instead of a chip, e.g. a message's time. */
	aside?: string;
}) {
	return (
		<li className="border-t border-black/6 first:border-t-0 sm:border-0">
			<Link
				href={href}
				className="flex items-center gap-3 py-2.5 transition focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-purple-500 sm:-mx-3 sm:rounded-2xl sm:px-3 sm:py-3 sm:hover:bg-panel-soft"
			>
				{person ? <Avatar name={person.name} avatarPath={person.avatarPath} size="md" /> : null}
				<span className="min-w-0 flex-1">
					<span className="flex items-baseline justify-between gap-2">
						<span className="min-w-0 truncate text-[0.9375rem] font-semibold">{title}</span>
						{aside ? <span className="shrink-0 text-xs whitespace-nowrap text-secondary">{aside}</span> : null}
					</span>
					{detail ? <span className="mt-0.5 block truncate text-[0.8125rem] text-secondary sm:text-sm">{detail}</span> : null}
				</span>
				{chip}
			</Link>
		</li>
	);
}

export function PanelEmpty({ text, link }: { text: string; link?: { href: string; label: string } }) {
	return (
		<div className="pt-2 pb-2.5 sm:pt-3">
			<p className="text-sm leading-normal text-secondary">{text}</p>
			{link ? (
				<Link href={link.href} className="brand-underline mt-1 inline-block py-3 text-sm leading-5 font-semibold">
					{link.label}
				</Link>
			) : null}
		</div>
	);
}
