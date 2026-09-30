import Link from "next/link";
import { completeWorkroomAction } from "@/app/dashboard/workroom-actions";
import type {
	ServiceWorkroomDetail,
	ServiceWorkroomStatus,
	ServiceWorkroomSummary,
} from "@/lib/service-workrooms/service";
import type { WorkroomStatusFilter } from "@/lib/service-workrooms/schemas";

type WorkroomActionContext =
	| "client-workrooms"
	| "client-workroom-detail"
	| "provider-home"
	| "provider-services"
	| "provider-workrooms"
	| "provider-workroom-detail";

type WorkroomSummary = ServiceWorkroomSummary | ServiceWorkroomDetail;

const statusOptions: Array<{ value: WorkroomStatusFilter; label: string }> = [
	{ value: "all", label: "All" },
	{ value: "active", label: "Active" },
	{ value: "completed", label: "Completed" },
];

export function workroomStatusLabel(status: ServiceWorkroomStatus) {
	return status === "completed" ? "Completed" : "Active";
}

export function workroomStatusClasses(status: ServiceWorkroomStatus) {
	return status === "completed"
		? "bg-emerald-50 text-emerald-700"
		: "bg-blue-50 text-blue-700";
}

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

export function WorkroomStatusBadge({
	status,
}: {
	status: ServiceWorkroomStatus;
}) {
	return (
		<span
			className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${workroomStatusClasses(
				status,
			)}`}
		>
			{workroomStatusLabel(status)}
		</span>
	);
}

export function WorkroomNotice({
	status,
	error,
}: {
	status?: string | null;
	error?: string | null;
}) {
	return (
		<>
			{status ? (
				<div className="rounded-2xl border border-emerald-100 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
					{status}
				</div>
			) : null}
			{error ? (
				<div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
					{error}
				</div>
			) : null}
		</>
	);
}

function serviceTitle(workroom: WorkroomSummary) {
	return workroom.service?.title ?? "Accepted service";
}

function otherPartyName(
	workroom: WorkroomSummary,
	viewerRole: "client" | "provider",
) {
	if (viewerRole === "client") {
		return workroom.provider?.full_name ?? "Provider";
	}

	return workroom.client?.full_name ?? "Client";
}

function requestMessage(workroom: WorkroomSummary) {
	return workroom.service_request?.message ?? "No agreement summary available.";
}

function hiddenActionFields({
	context,
	status,
	page,
}: {
	context: WorkroomActionContext;
	status?: WorkroomStatusFilter;
	page?: number;
}) {
	return (
		<>
			<input type="hidden" name="context" value={context} />
			{status ? <input type="hidden" name="status" value={status} /> : null}
			{page ? <input type="hidden" name="page" value={String(page)} /> : null}
		</>
	);
}

export function WorkroomActions({
	workroom,
	viewerRole,
	context,
	status,
	page,
	showDetailsLink = true,
}: {
	workroom: WorkroomSummary;
	viewerRole: "client" | "provider";
	context: WorkroomActionContext;
	status?: WorkroomStatusFilter;
	page?: number;
	showDetailsLink?: boolean;
}) {
	return (
		<div className="flex shrink-0 flex-wrap gap-2">
			{showDetailsLink ? (
				<Link
					href={`/dashboard/workrooms/${workroom.id}`}
					className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
				>
					View workroom
				</Link>
			) : null}
			{workroom.conversation_id ? (
				<Link
					href={`/dashboard/messages?conversation=${workroom.conversation_id}`}
					className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
				>
					Message
				</Link>
			) : null}
			{viewerRole === "provider" && workroom.status === "active" ? (
				<form action={completeWorkroomAction.bind(null, workroom.id)}>
					{hiddenActionFields({ context, status, page })}
					<button
						type="submit"
						className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
					>
						Mark completed
					</button>
				</form>
			) : null}
		</div>
	);
}

export function WorkroomCard({
	workroom,
	viewerRole,
	context,
	status,
	page,
	compact = false,
}: {
	workroom: WorkroomSummary;
	viewerRole: "client" | "provider";
	context: WorkroomActionContext;
	status?: WorkroomStatusFilter;
	page?: number;
	compact?: boolean;
}) {
	return (
		<article className="rounded-3xl border border-line bg-white p-5">
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="wrap-break-word text-lg font-semibold text-black">
							{serviceTitle(workroom)}
						</h2>
						<WorkroomStatusBadge status={workroom.status} />
					</div>
					<p className="mt-1 text-sm text-secondary">
						{otherPartyName(workroom, viewerRole)} · Accepted{" "}
						{formatWorkroomTimeAgo(workroom.accepted_at)}
					</p>
					<p
						className={`mt-4 whitespace-pre-line wrap-break-word text-sm leading-6 text-black/75 ${
							compact ? "line-clamp-2" : ""
						}`}
					>
						{requestMessage(workroom)}
					</p>
				</div>
				<WorkroomActions
					workroom={workroom}
					viewerRole={viewerRole}
					context={context}
					status={status}
					page={page}
				/>
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

export function WorkroomStatusFilters({
	basePath,
	activeStatus,
}: {
	basePath: string;
	activeStatus: WorkroomStatusFilter;
}) {
	return (
		<nav aria-label="Workroom status filters" className="flex flex-wrap gap-2">
			{statusOptions.map((option) => (
				<Link
					key={option.value}
					href={buildWorkroomListHref({
						basePath,
						status: option.value,
						page: 1,
					})}
					className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
						option.value === activeStatus
							? "border-black bg-black text-white"
							: "border-line bg-white text-black hover:bg-black/3"
					}`}
				>
					{option.label}
				</Link>
			))}
		</nav>
	);
}

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
	const visibleTotalPages = Math.max(totalPages, 1);
	const previousPage = Math.max(1, page - 1);
	const nextPage = Math.min(visibleTotalPages, page + 1);
	const hasPrevious = page > 1;
	const hasNext = page < visibleTotalPages;

	return (
		<nav
			aria-label="Workroom pagination"
			className="flex items-center justify-between gap-4"
		>
			{hasPrevious ? (
				<Link
					href={buildWorkroomListHref({
						basePath,
						status,
						page: previousPage,
					})}
					aria-label="Go to previous workroom page"
					className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
				>
					Previous
				</Link>
			) : (
				<span
					aria-disabled="true"
					className="rounded-2xl border border-line bg-zinc-50 px-4 py-2 text-sm font-semibold text-secondary"
				>
					Previous
				</span>
			)}
			<span className="text-sm font-semibold text-secondary">
				Page {page} of {visibleTotalPages}
			</span>
			{hasNext ? (
				<Link
					href={buildWorkroomListHref({
						basePath,
						status,
						page: nextPage,
					})}
					aria-label="Go to next workroom page"
					className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
				>
					Next
				</Link>
			) : (
				<span
					aria-disabled="true"
					className="rounded-2xl border border-line bg-zinc-50 px-4 py-2 text-sm font-semibold text-secondary"
				>
					Next
				</span>
			)}
		</nav>
	);
}
