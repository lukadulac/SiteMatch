import Link from "next/link";
import type { ReactNode } from "react";
import type {
	ServiceWorkroomDetail,
	ServiceWorkroomStatus,
	ServiceWorkroomSummary,
	WorkroomStatusCounts,
} from "@/lib/service-workrooms/service";
import type { WorkroomStatusFilter } from "@/lib/service-workrooms/schemas";
import { Avatar } from "@/components/profile/avatar";

type WorkroomSummary = ServiceWorkroomSummary | ServiceWorkroomDetail;

const statusOptions: Array<{ value: WorkroomStatusFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "completed", label: "Completed" },
];

export function formatWorkroomDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}

export function formatWorkroomTimeAgo(value: string) {
	const diffMs = Date.now() - new Date(value).getTime();
	const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

	if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	}

	const diffDays = Math.floor(diffHours / 24);

	return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
	return (
		<svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
			<path d={direction === "left" ? "M15 18l-6-6 6-6" : "M9 18l6-6-6-6"} />
		</svg>
	);
}

function CheckIcon({ className }: { className: string }) {
	return (
		<svg aria-hidden="true" className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
			<path d="M5 12.5l4.5 4.5L19 7.5" />
		</svg>
	);
}

export function WorkroomStatusBadge({
	status,
	size = "md",
}: {
	status: ServiceWorkroomStatus;
	size?: "sm" | "md";
}) {
	const sizeClasses = size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-[0.8125rem]";

	return status === "completed" ? (
		<span className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-zinc-100 font-semibold text-zinc-700 ${sizeClasses}`}>
			<CheckIcon className="size-3.5" />
			Completed
		</span>
	) : (
		<span className={`inline-flex shrink-0 items-center gap-2 rounded-full bg-green-100 font-semibold text-green-800 ${sizeClasses}`}>
			<span aria-hidden="true" className="size-1.75 rounded-full bg-green-600" />
			Active
		</span>
	);
}

export function WorkroomNotice({
	status,
	error,
	dismissHref,
	retry,
}: {
	status?: string | null;
	error?: string | null;
	/** Where the dismiss button goes: the same page without the notice in its URL. */
	dismissHref?: string;
	/** Shown in the error notice, e.g. a button that tries the action again. */
	retry?: ReactNode;
}) {
	return (
		<>
			{status ? (
				<div
					role="status"
					className="flex items-center gap-3 rounded-[1.25rem] border border-green-700/20 bg-green-50 py-2 pr-2 pl-4"
				>
					<svg aria-hidden="true" className="size-5 shrink-0 text-green-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
						<circle cx="12" cy="12" r="9" />
						<path d="M8 12.5l2.7 2.7L16 9.8" />
					</svg>
					<p className="min-w-0 flex-1 py-1.5 text-[0.9375rem] text-green-900">{status}</p>
					{dismissHref ? (
						<Link
							href={dismissHref}
							replace
							scroll={false}
							aria-label="Dismiss"
							className="flex size-11 shrink-0 items-center justify-center rounded-xl text-green-900 transition hover:bg-green-100"
						>
							<svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
								<path d="M6 6l12 12M18 6L6 18" />
							</svg>
						</Link>
					) : null}
				</div>
			) : null}
			{error ? (
				<div
					role="alert"
					className="flex flex-wrap items-center gap-3 rounded-[1.25rem] border border-red-700/20 bg-red-50 py-2 pr-2 pl-4"
				>
					<svg aria-hidden="true" className="size-5 shrink-0 text-red-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
						<circle cx="12" cy="12" r="9" />
						<path d="M12 7.5v5M12 16.5h.01" />
					</svg>
					<p className="min-w-0 flex-1 py-1.5 text-[0.9375rem] text-red-900">{error}</p>
					{retry}
				</div>
			) : null}
		</>
	);
}

function otherParty(
	workroom: WorkroomSummary,
	viewerRole: "client" | "provider",
) {
	const party = viewerRole === "client" ? workroom.provider : workroom.client;

	return {
		name: party?.full_name ?? (viewerRole === "client" ? "Provider" : "Client"),
		avatarPath: party?.avatar_url ?? null,
	};
}

/** One hire in a list. The whole card opens the workroom; Message stays its own link. */
export function WorkroomCard({
	workroom,
	viewerRole,
}: {
	workroom: WorkroomSummary;
	viewerRole: "client" | "provider";
}) {
	const party = otherParty(workroom, viewerRole);

	return (
		<article className="relative rounded-3xl border border-line bg-white p-4.5 transition hover:border-line-strong sm:px-6 sm:py-5">
			<div className="flex items-start justify-between gap-3 sm:items-center sm:gap-4">
				<h2 className="min-w-0 text-base leading-snug font-semibold wrap-break-word sm:text-[1.0625rem]">
					<Link href={`/dashboard/workrooms/${workroom.id}`} className="text-foreground">
						<span aria-hidden="true" className="absolute inset-0 rounded-3xl" />
						{workroom.service?.title ?? "Accepted service"}
					</Link>
				</h2>
				<WorkroomStatusBadge status={workroom.status} size="sm" />
			</div>
			<p className="mt-2.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-secondary sm:text-sm">
				<Avatar name={party.name} avatarPath={party.avatarPath} size="sm" />
				<span className="font-semibold text-foreground">{party.name}</span>
				<span aria-hidden="true">·</span>
				<span>Accepted {formatWorkroomTimeAgo(workroom.accepted_at)}</span>
			</p>
			<div className="mt-2.5 sm:flex sm:items-end sm:gap-5">
				<p className="line-clamp-2 min-w-0 flex-1 text-sm leading-normal wrap-break-word text-secondary sm:text-[0.9375rem]">
					{workroom.service_request?.message ?? "No agreement summary available."}
				</p>
				{workroom.conversation_id ? (
					<Link
						href={`/dashboard/messages?conversation=${workroom.conversation_id}`}
						className="relative z-10 mt-3.5 flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold text-foreground transition hover:bg-black/3 sm:mt-0 sm:min-h-10"
					>
						Message
					</Link>
				) : null}
			</div>
		</article>
	);
}

function buildWorkroomListHref({
	basePath,
	status,
	page,
}: {
	basePath: string;
	status: WorkroomStatusFilter;
	page: number;
}) {
	const params = new URLSearchParams();

	if (status !== "all") {
		params.set("status", status);
	}

	if (page > 1) {
		params.set("page", String(page));
	}

	const query = params.toString();

	return query ? `${basePath}?${query}` : basePath;
}

/** Scrolling pills on phones, a segmented control from sm up. */
export function WorkroomStatusFilters({
	basePath,
	activeStatus,
	counts,
}: {
	basePath: string;
	activeStatus: WorkroomStatusFilter;
	counts: WorkroomStatusCounts;
}) {
	return (
		<nav aria-label="Filter workrooms" className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
			<ul className="flex gap-2 sm:inline-flex sm:gap-1 sm:rounded-2xl sm:border sm:border-line sm:bg-white sm:p-1">
				{statusOptions.map((option) => {
					const active = option.value === activeStatus;

					return (
						<li key={option.value} className="shrink-0">
							<Link
								href={buildWorkroomListHref({ basePath, status: option.value, page: 1 })}
								aria-current={active ? "page" : undefined}
								className={`flex min-h-11 items-center gap-2 rounded-2xl border px-4 text-sm font-semibold whitespace-nowrap transition sm:min-h-10 sm:rounded-xl sm:border-0 ${
									active
										? "border-black bg-black text-white"
										: "border-line bg-white text-secondary hover:text-foreground sm:bg-transparent"
								}`}
							>
								{option.label}
								<span
									className={`rounded-full px-2 py-0.5 text-xs ${
										active ? "bg-white/20 text-white" : "bg-zinc-100 text-secondary"
									}`}
								>
									{counts[option.value]}
								</span>
							</Link>
						</li>
					);
				})}
			</ul>
		</nav>
	);
}

const pageLinkClasses =
	"inline-flex min-h-11 items-center gap-1.5 rounded-2xl border border-line-strong bg-white px-3.5 text-sm font-semibold sm:px-4.5";

export function WorkroomPagination({
	basePath,
	status,
	page,
	totalPages,
}: {
	basePath: string;
	status: WorkroomStatusFilter;
	page: number;
	totalPages: number;
}) {
	if (totalPages <= 1) {
		return null;
	}

	const hasPrevious = page > 1;
	const hasNext = page < totalPages;

	return (
		<nav aria-label="Workroom pagination" className="flex items-center justify-between gap-3">
			{hasPrevious ? (
				<Link
					href={buildWorkroomListHref({ basePath, status, page: page - 1 })}
					aria-label="Go to previous workroom page"
					className={`${pageLinkClasses} text-foreground transition hover:bg-black/3`}
				>
					<ChevronIcon direction="left" />
					Previous
				</Link>
			) : (
				<span aria-disabled="true" className={`${pageLinkClasses} text-secondary opacity-60`}>
					<ChevronIcon direction="left" />
					Previous
				</span>
			)}
			<span className="text-sm text-secondary">
				Page {page} of {totalPages}
			</span>
			{hasNext ? (
				<Link
					href={buildWorkroomListHref({ basePath, status, page: page + 1 })}
					aria-label="Go to next workroom page"
					className={`${pageLinkClasses} text-foreground transition hover:bg-black/3`}
				>
					Next
					<ChevronIcon direction="right" />
				</Link>
			) : (
				<span aria-disabled="true" className={`${pageLinkClasses} text-secondary opacity-60`}>
					Next
					<ChevronIcon direction="right" />
				</span>
			)}
		</nav>
	);
}

const emptyCopy: Record<WorkroomStatusFilter, { title: string; body: string }> = {
	all: {
		title: "No workrooms yet",
		body: "When a service request is accepted, its workroom appears here.",
	},
	active: {
		title: "No active workrooms",
		body: "When a service request is accepted, its workroom appears here.",
	},
	completed: {
		title: "No completed workrooms yet",
		body: "Workrooms move here once the work is marked completed.",
	},
};

export function WorkroomEmptyState({
	status,
	serviceRequestsHref,
}: {
	status: WorkroomStatusFilter;
	serviceRequestsHref: string;
}) {
	const copy = emptyCopy[status];

	return (
		<section className="flex flex-col items-center rounded-[1.75rem] border border-line bg-white px-5 py-12 text-center sm:px-8 sm:py-14">
			<span className="flex size-14 items-center justify-center rounded-[1.125rem] border border-line bg-panel-soft">
				<svg aria-hidden="true" className="size-6 text-secondary" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
					<rect x="3.5" y="6" width="17" height="13" rx="3" />
					<path d="M8.5 6V4.5h7V6M3.5 11.5h17" />
				</svg>
			</span>
			<h2 className="mt-4.5 text-lg font-semibold">{copy.title}</h2>
			<p className="mt-1.5 max-w-md text-[0.9375rem] leading-normal text-secondary">{copy.body}</p>
			<Link
				href={serviceRequestsHref}
				className="mt-5 inline-flex min-h-11 items-center rounded-2xl border border-line-strong px-4.5 text-sm font-semibold text-foreground transition hover:bg-black/3"
			>
				Go to Service requests
			</Link>
		</section>
	);
}
