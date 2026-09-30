import Link from "next/link";
import {
	acceptServiceRequestAction,
	cancelServiceRequestAction,
	rejectServiceRequestAction,
} from "@/app/dashboard/service-request-actions";
import type {
	ClientServiceRequest,
	ProviderIncomingServiceRequest,
	ProviderServiceRequestStatus,
	ServiceRequestDetail,
} from "@/lib/provider-service-requests/service";
import type { ServiceRequestStatusFilter } from "@/lib/provider-service-requests/schemas";

type RequestActionContext =
	| "client-home"
	| "client-list"
	| "client-detail"
	| "provider-services"
	| "provider-list"
	| "provider-detail";

type ServiceRequestSummary =
	| ClientServiceRequest
	| ProviderIncomingServiceRequest
	| ServiceRequestDetail;

const statusOptions: Array<{
	value: ServiceRequestStatusFilter;
	label: string;
}> = [
	{ value: "all", label: "All" },
	{ value: "pending", label: "Pending" },
	{ value: "accepted", label: "Accepted" },
	{ value: "rejected", label: "Rejected" },
	{ value: "cancelled", label: "Cancelled" },
];

export function serviceRequestStatusLabel(status: string) {
	switch (status) {
		case "accepted":
			return "Accepted";
		case "rejected":
			return "Rejected";
		case "cancelled":
			return "Cancelled";
		default:
			return "Pending";
	}
}

export function serviceRequestStatusClasses(status: string) {
	switch (status) {
		case "accepted":
			return "bg-emerald-50 text-emerald-700";
		case "rejected":
		case "cancelled":
			return "bg-red-50 text-red-700";
		default:
			return "bg-blue-50 text-blue-700";
	}
}

export function formatServiceRequestDate(value: string) {
	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}

export function formatServiceRequestTimeAgo(value: string) {
	const diffMs = Date.now() - new Date(value).getTime();
	const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

	if (diffHours < 24) {
		return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
	}

	const diffDays = Math.floor(diffHours / 24);

	return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function otherPartyName(
	request: ServiceRequestSummary,
	viewerRole: "client" | "provider",
) {
	if (viewerRole === "client" && "provider" in request) {
		return request.provider?.full_name ?? "Provider";
	}

	if (viewerRole === "provider" && "client" in request) {
		return request.client?.full_name ?? "Client";
	}

	return viewerRole === "client" ? "Provider" : "Client";
}

function serviceTitle(request: ServiceRequestSummary) {
	return request.service?.title ?? "Requested service";
}

function hiddenActionFields({
	context,
	status,
	page,
}: {
	context: RequestActionContext;
	status?: ServiceRequestStatusFilter;
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

export function ServiceRequestActions({
	request,
	viewerRole,
	context,
	status,
	page,
	showDetailsLink = true,
}: {
	request: ServiceRequestSummary;
	viewerRole: "client" | "provider";
	context: RequestActionContext;
	status?: ServiceRequestStatusFilter;
	page?: number;
	showDetailsLink?: boolean;
}) {
	return (
		<div className="flex shrink-0 flex-wrap gap-2">
			{showDetailsLink ? (
				<Link
					href={`/dashboard/service-requests/${request.id}`}
					className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
				>
					View details
				</Link>
			) : null}
			{request.conversation_id ? (
				<Link
					href={`/dashboard/messages?conversation=${request.conversation_id}`}
					className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
				>
					Message
				</Link>
			) : null}
			{viewerRole === "client" && request.status === "pending" ? (
				<form action={cancelServiceRequestAction.bind(null, request.id)}>
					{hiddenActionFields({ context, status, page })}
					<button
						type="submit"
						className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
					>
						Cancel
					</button>
				</form>
			) : null}
			{viewerRole === "provider" && request.status === "pending" ? (
				<>
					<form action={acceptServiceRequestAction.bind(null, request.id)}>
						{hiddenActionFields({ context, status, page })}
						<button
							type="submit"
							className="rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
						>
							Accept
						</button>
					</form>
					<form action={rejectServiceRequestAction.bind(null, request.id)}>
						{hiddenActionFields({ context, status, page })}
						<button
							type="submit"
							className="rounded-2xl border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 transition hover:bg-red-100"
						>
							Reject
						</button>
					</form>
				</>
			) : null}
		</div>
	);
}

export function ServiceRequestCard({
	request,
	viewerRole,
	context,
	status,
	page,
	compact = false,
}: {
	request: ServiceRequestSummary;
	viewerRole: "client" | "provider";
	context: RequestActionContext;
	status?: ServiceRequestStatusFilter;
	page?: number;
	compact?: boolean;
}) {
	return (
		<article className="rounded-3xl border border-line bg-white p-5">
			<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
				<div className="min-w-0">
					<div className="flex flex-wrap items-center gap-2">
						<h2 className="wrap-break-word text-lg font-semibold text-black">
							{serviceTitle(request)}
						</h2>
						<span
							className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${serviceRequestStatusClasses(
								request.status,
							)}`}
						>
							{serviceRequestStatusLabel(request.status)}
						</span>
					</div>
					<p className="mt-1 text-sm text-secondary">
						{otherPartyName(request, viewerRole)} ·{" "}
						{formatServiceRequestTimeAgo(request.created_at)}
					</p>
					<p
						className={`mt-4 whitespace-pre-line wrap-break-word text-sm leading-6 text-black/75 ${
							compact ? "line-clamp-2" : ""
						}`}
					>
						{request.message}
					</p>
				</div>
				<ServiceRequestActions
					request={request}
					viewerRole={viewerRole}
					context={context}
					status={status}
					page={page}
				/>
			</div>
		</article>
	);
}

export function ServiceRequestNotice({
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

function buildServiceRequestListHref({
	basePath,
	status,
	page,
}: {
	basePath: string;
	status: ServiceRequestStatusFilter;
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

export function ServiceRequestStatusFilters({
	basePath,
	activeStatus,
}: {
	basePath: string;
	activeStatus: ServiceRequestStatusFilter;
}) {
	return (
		<nav aria-label="Service request status filters" className="flex flex-wrap gap-2">
			{statusOptions.map((option) => (
				<Link
					key={option.value}
					href={buildServiceRequestListHref({
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

export function ServiceRequestPagination({
	basePath,
	status,
	page,
	totalPages,
}: {
	basePath: string;
	status: ServiceRequestStatusFilter;
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
			aria-label="Service request pagination"
			className="flex items-center justify-between gap-4"
		>
			{hasPrevious ? (
				<Link
					href={buildServiceRequestListHref({
						basePath,
						status,
						page: previousPage,
					})}
					aria-label="Go to previous service request page"
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
					href={buildServiceRequestListHref({
						basePath,
						status,
						page: nextPage,
					})}
					aria-label="Go to next service request page"
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

export function ServiceRequestStatusBadge({
	status,
}: {
	status: ProviderServiceRequestStatus;
}) {
	return (
		<span
			className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${serviceRequestStatusClasses(
				status,
			)}`}
		>
			{serviceRequestStatusLabel(status)}
		</span>
	);
}
