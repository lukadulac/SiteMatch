import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteProviderServiceListingAction } from "@/app/dashboard/provider/services/actions";
import { DashboardPanel, DashboardShell } from "@/components/dashboard/DashboardShell";
import { ActionSubmitButton } from "@/components/dashboard/ActionSubmitButton";
import { DashboardListPagination, DashboardStatusFilters, DASHBOARD_LIST_PAGE_SIZE, dashboardListHref, parseDashboardPage, parseDashboardStatus } from "@/components/dashboard/DashboardListControls";
import {
	ServiceRequestCard,
	ServiceRequestNotice,
} from "@/components/service-requests/service-request-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUnreadConversationCount } from "@/lib/messaging/service";
import { getProviderServiceRequestPreview } from "@/lib/provider-service-requests/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function statusClasses(status: string) {
	switch (status) {
		case "published":
			return "bg-emerald-50 text-emerald-700";
		case "paused":
			return "bg-amber-50 text-amber-700";
		default:
			return "bg-zinc-100 text-zinc-700";
	}
}

function statusLabel(status: string) {
	switch (status) {
		case "published":
			return "Published";
		case "paused":
			return "Paused";
		default:
			return "Draft";
	}
}

function priceLabel({
	priceType,
	startingPrice,
}: {
	priceType: string;
	startingPrice: number | null;
}) {
	if (priceType === "negotiable") {
		return "Negotiable";
	}

	if (startingPrice == null) {
		return "Price not set";
	}

	const formattedPrice = `$${startingPrice.toLocaleString()}`;

	if (priceType === "hourly") {
		return `${formattedPrice}/hr`;
	}

	if (priceType === "starting_at") {
		return `Starting at ${formattedPrice}`;
	}

	return formattedPrice;
}

export default async function ProviderServicesPage({
	searchParams,
}: {
	searchParams?: Promise<{
		serviceError?: string | string[];
		serviceStatus?: string | string[];
		status?: string | string[];
		page?: string | string[];
	}>;
}) {
	const params = await searchParams;
	const serviceError =
		typeof params?.serviceError === "string" ? params.serviceError : null;
	const serviceStatus =
		typeof params?.serviceStatus === "string" ? params.serviceStatus : null;
	const status = parseDashboardStatus(params?.status, ["all", "draft", "published", "paused"] as const);
	const page = parseDashboardPage(params?.page);
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

	if (provisioned.role !== "provider") {
		redirect(getDashboardPath(provisioned.role));
	}

	const [
		unreadCountResult,
		applicationsResult,
		servicesCountResult,
		serviceRequestsResult,
	] =
		await Promise.all([
			getUnreadConversationCount(supabase, user.id),
			supabase
				.from("applications")
				.select("id", { count: "exact", head: true })
				.eq("provider_id", user.id),
			(() => {
				let query = supabase
					.from("provider_service_listings")
					.select("id", { count: "exact", head: true })
					.eq("provider_id", user.id);
				if (status !== "all") query = query.eq("status", status);
				return query;
			})(),
			getProviderServiceRequestPreview(supabase, user.id),
		]);

	if (unreadCountResult.error) {
		throw new Error(unreadCountResult.error);
	}

	if (applicationsResult.error) {
		throw new Error(applicationsResult.error.message);
	}

	if (servicesCountResult.error) {
		throw new Error(servicesCountResult.error.message);
	}

	if (serviceRequestsResult.error) {
		throw new Error(serviceRequestsResult.error);
	}

	const unreadConversationCount = unreadCountResult.data ?? 0;
	const applicationCount = applicationsResult.count ?? 0;
	const totalCount = servicesCountResult.count ?? 0;
	const totalPages = Math.ceil(totalCount / DASHBOARD_LIST_PAGE_SIZE);
	if (page > Math.max(1, totalPages)) redirect(dashboardListHref("/dashboard/provider/services", status, Math.max(1, totalPages)));
	let servicesQuery = supabase
		.from("provider_service_listings")
		.select("id, title, description, status, price_type, starting_price, delivery_estimate, service_type_text, category_text, created_at")
		.eq("provider_id", user.id);
	if (status !== "all") servicesQuery = servicesQuery.eq("status", status);
	const servicesResult = await servicesQuery.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * DASHBOARD_LIST_PAGE_SIZE, page * DASHBOARD_LIST_PAGE_SIZE - 1);
	if (servicesResult.error) throw new Error(servicesResult.error.message);
	const services = servicesResult.data ?? [];
	const serviceRequests = serviceRequestsResult.data ?? [];

	return (
		<DashboardShell
			title="Services"
			subtitle="Create and manage service offers clients can discover."
			actionHref="/dashboard/provider/services/post"
			actionLabel="Post Service"
			navItems={[
				{ href: "/dashboard/provider", label: "Overview" },
				{
					href: "/dashboard/provider/applications",
					label: "Applications",
					count: applicationCount,
				},
				{
					href: "/dashboard/provider/services",
					label: "Services",
					count: totalCount,
					active: true,
				},
				{
					href: "/dashboard/provider/service-requests",
					label: "Service Requests",
				},
				{ href: "/dashboard/provider/workrooms", label: "Workrooms" },
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadConversationCount,
				},
				{ href: "/dashboard/provider/profile", label: "Profile" },
			]}
		>
			<DashboardPanel
				title="Incoming Service Requests"
				action={
					<Link
						href="/dashboard/provider/service-requests"
						className="shrink-0 text-sm font-semibold text-black transition hover:opacity-70"
					>
						View all requests
					</Link>
				}
			>
				<div className="mb-4 space-y-3">
					<ServiceRequestNotice status={serviceStatus} error={serviceError} />
				</div>
				{serviceRequests.length ? (
					<div className="space-y-4">
						{serviceRequests.map((request) => (
							<ServiceRequestCard
								key={request.id}
								request={request}
								viewerRole="provider"
								context="provider-services"
								compact
							/>
						))}
					</div>
				) : (
					<div className="rounded-3xl border border-dashed border-line-strong bg-panel-soft p-8 text-center">
						<h2 className="text-2xl font-semibold text-black">
							No incoming requests yet
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
							When clients request one of your published services, those
							requests will appear here.
						</p>
					</div>
				)}
			</DashboardPanel>

			<DashboardPanel title="My Services">
				<div className="mb-5 flex flex-wrap items-center justify-between gap-3">
					<p className="text-sm text-secondary">{totalCount} service{totalCount === 1 ? "" : "s"}</p>
					<DashboardStatusFilters basePath="/dashboard/provider/services" status={status} options={[{ value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "paused", label: "Paused" }]} />
				</div>
				{services.length ? (
					<div className="space-y-4">
						{services.map((service) => (
							<article
								key={service.id}
								className="rounded-3xl border border-line bg-white p-5"
							>
								<div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
									<div className="min-w-0">
										<h2 className="wrap-break-word text-xl font-semibold text-black">
											{service.title}
										</h2>
										<p className="mt-2 line-clamp-2 text-sm leading-6 text-secondary">
											{service.description}
										</p>
									</div>
									<div className="flex shrink-0 flex-wrap items-center gap-2">
										<span
											className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${statusClasses(
												service.status,
											)}`}
										>
											{statusLabel(service.status)}
										</span>
										<Link
											href={`/dashboard/provider/services/${service.id}`}
											className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
										>
											Edit
										</Link>
										<form
											action={deleteProviderServiceListingAction.bind(
												null,
												service.id,
											)}
										>
											<ActionSubmitButton
												label="Delete"
												pendingLabel="Deleting..."
												confirmMessage="Delete this service listing? Listings with client requests cannot be deleted."
												className="rounded-lg border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
											/>
										</form>
									</div>
								</div>
								<div className="mt-5 flex flex-wrap gap-2 text-sm text-secondary">
									{service.service_type_text ? (
										<span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold">
											{service.service_type_text}
										</span>
									) : null}
									{service.category_text ? (
										<span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold">
											{service.category_text}
										</span>
									) : null}
									<span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold">
										{priceLabel({
											priceType: service.price_type,
											startingPrice: service.starting_price,
										})}
									</span>
									{service.delivery_estimate ? (
										<span className="rounded-full bg-zinc-100 px-3 py-1 font-semibold">
											{service.delivery_estimate}
										</span>
									) : null}
								</div>
							</article>
						))}
					</div>
				) : (
					<div className="rounded-3xl border border-dashed border-line-strong bg-panel-soft p-8 text-center">
						<h2 className="text-lg font-semibold text-black">
							{status === "all" ? "No services posted yet" : `No ${status} services`}
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
							{status === "all" ? "Post your first service so clients can understand what you offer." : "Try another status filter or create a new service."}
						</p>
						<Link
							href="/dashboard/provider/services/post"
							className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
						>
							Post Service
						</Link>
					</div>
				)}
				<DashboardListPagination basePath="/dashboard/provider/services" status={status} page={page} totalPages={totalPages} />
			</DashboardPanel>
		</DashboardShell>
	);
}
