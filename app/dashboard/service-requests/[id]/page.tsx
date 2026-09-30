import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
	formatServiceRequestDate,
	ServiceRequestActions,
	ServiceRequestNotice,
	ServiceRequestStatusBadge,
} from "@/components/service-requests/service-request-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { getServiceRequestDetailForParticipant } from "@/lib/provider-service-requests/service";
import { priceTypeLabel } from "@/lib/provider-services/formatters";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type ServiceRequestDetailPageProps = {
	params: Promise<{ id: string }>;
	searchParams?: Promise<{
		serviceError?: string | string[];
		serviceStatus?: string | string[];
	}>;
};

function formatPrice({
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

	const formattedPrice = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	}).format(startingPrice);

	if (priceType === "hourly") {
		return `${formattedPrice}/hr`;
	}

	if (priceType === "starting_at") {
		return `Starting at ${formattedPrice}`;
	}

	return formattedPrice;
}

function partyLocation(party: { city: string | null; country: string | null } | null) {
	return [party?.city, party?.country]
		.filter((value): value is string => Boolean(value))
		.join(", ");
}

export default async function ServiceRequestDetailPage({
	params,
	searchParams,
}: ServiceRequestDetailPageProps) {
	const { id } = await params;
	const query = await searchParams;
	const serviceError =
		typeof query?.serviceError === "string" ? query.serviceError : null;
	const serviceStatus =
		typeof query?.serviceStatus === "string" ? query.serviceStatus : null;
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

	if (provisioned.role !== "client" && provisioned.role !== "provider") {
		redirect(getDashboardPath(provisioned.role));
	}

	const [conversationsResult, requestResult] = await Promise.all([
		getUserConversations(supabase, user.id),
		getServiceRequestDetailForParticipant(supabase, user.id, id),
	]);

	if (conversationsResult.error) {
		throw new Error(conversationsResult.error);
	}

	if (requestResult.error) {
		throw new Error(requestResult.error);
	}

	if (!requestResult.data) {
		notFound();
	}

	const request = requestResult.data;
	const viewerRole = request.client_id === user.id ? "client" : "provider";
	const otherParty = viewerRole === "client" ? request.provider : request.client;
	const otherPartyLabel = viewerRole === "client" ? "Provider" : "Client";
	const unreadConversations =
		conversationsResult.data?.filter((conversation) => conversation.unread_count > 0) ??
		[];
	const roleDashboardPath = getDashboardPath(provisioned.role);
	const listPath =
		viewerRole === "client"
			? "/dashboard/client/service-requests"
			: "/dashboard/provider/service-requests";
	const service = request.service;
	const detailItems = [
		["Status", service ? service.status : "Service unavailable"],
		["Pricing", service ? formatPrice({
			priceType: service.price_type,
			startingPrice: service.starting_price,
		}) : "Price unavailable"],
		["Pricing model", service ? priceTypeLabel(service.price_type) : "Pricing unavailable"],
		["Delivery", service?.delivery_estimate ?? "Flexible"],
		["Service type", service?.service_type_text ?? "Service"],
		["Category", service?.category_text ?? "General"],
	];

	return (
		<DashboardShell
			title="Service Request"
			subtitle="Review request details, continue the conversation, and manage the request decision."
			actionHref={listPath}
			actionLabel="Back to Requests"
			navItems={[
				{ href: roleDashboardPath, label: "Overview" },
				...(viewerRole === "client"
					? [{ href: "/dashboard/client/projects", label: "Projects" }]
					: [
							{
								href: "/dashboard/provider/applications",
								label: "Applications",
							},
							{ href: "/dashboard/provider/services", label: "Services" },
						]),
				{
					href: listPath,
					label: "Service Requests",
					active: true,
				},
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadConversations.length,
				},
				{
					href:
						viewerRole === "client"
							? "/dashboard/client/profile"
							: "/dashboard/provider/profile",
					label: "Profile",
				},
			]}
		>
			<section className="space-y-5">
				<ServiceRequestNotice status={serviceStatus} error={serviceError} />

				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
					<div className="space-y-5">
						<article className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)] sm:p-7">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<ServiceRequestStatusBadge status={request.status} />
										<span className="text-sm font-semibold text-secondary">
											Sent {formatServiceRequestDate(request.created_at)}
										</span>
									</div>
									<h2 className="mt-4 wrap-break-word text-3xl font-semibold text-black">
										{service?.title ?? "Requested service"}
									</h2>
								</div>
								{service ? (
									<Link
										href={`/find-talent/${service.id}`}
										className="inline-flex min-h-11 shrink-0 items-center justify-center rounded-2xl border border-line px-4 text-sm font-semibold text-black transition hover:bg-black/3"
									>
										View service
									</Link>
								) : null}
							</div>

							<div className="mt-7">
								<h3 className="text-lg font-semibold text-black">
									Original request message
								</h3>
								<p className="mt-4 whitespace-pre-line wrap-break-word rounded-3xl border border-line bg-panel-soft p-5 text-sm leading-6 text-black/80">
									{request.message}
								</p>
							</div>
						</article>

						<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)] sm:p-7">
							<h3 className="text-lg font-semibold text-black">
								Service information
							</h3>
							<div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
								{detailItems.map(([label, value]) => (
									<div key={label} className="rounded-2xl bg-panel-soft p-4">
										<p className="text-xs font-semibold uppercase tracking-wide text-secondary">
											{label}
										</p>
										<p className="mt-2 wrap-break-word text-sm font-semibold text-black">
											{value}
										</p>
									</div>
								))}
							</div>
						</section>
					</div>

					<aside className="space-y-4">
						<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)]">
							<p className="text-sm font-semibold text-secondary">
								{otherPartyLabel}
							</p>
							<div className="mt-4 flex items-center gap-3">
								<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-pink-100 text-sm font-bold text-violet-700">
									{otherParty?.full_name?.slice(0, 1) ?? otherPartyLabel.slice(0, 1)}
								</div>
								<div className="min-w-0">
									<p className="wrap-break-word font-semibold text-black">
										{otherParty?.full_name ?? otherPartyLabel}
									</p>
									<p className="text-sm text-secondary">
										{partyLocation(otherParty) || "Remote"}
									</p>
								</div>
							</div>
						</section>

						<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)]">
							<h3 className="text-lg font-semibold text-black">Actions</h3>
							<div className="mt-5 flex flex-col gap-3">
								{request.conversation_id ? (
									<Link
										href={`/dashboard/messages?conversation=${request.conversation_id}`}
										className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-black px-4 text-sm font-semibold text-white transition hover:opacity-90"
									>
										Open conversation
									</Link>
								) : (
									<div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
										Conversation unavailable
									</div>
								)}
								<ServiceRequestActions
									request={request}
									viewerRole={viewerRole}
									context={
										viewerRole === "client"
											? "client-detail"
											: "provider-detail"
									}
									showDetailsLink={false}
								/>
							</div>
						</section>
					</aside>
				</div>
			</section>
		</DashboardShell>
	);
}
