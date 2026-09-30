import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
	formatWorkroomDate,
	WorkroomActions,
	WorkroomNotice,
	WorkroomStatusBadge,
} from "@/components/workrooms/workroom-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { priceTypeLabel } from "@/lib/provider-services/formatters";
import { getWorkroomDetailForParticipant } from "@/lib/service-workrooms/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type WorkroomDetailPageProps = {
	params: Promise<{ id: string }>;
	searchParams?: Promise<{
		workroomError?: string | string[];
		workroomStatus?: string | string[];
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

export default async function WorkroomDetailPage({
	params,
	searchParams,
}: WorkroomDetailPageProps) {
	const { id } = await params;
	const query = await searchParams;
	const workroomError =
		typeof query?.workroomError === "string" ? query.workroomError : null;
	const workroomStatus =
		typeof query?.workroomStatus === "string" ? query.workroomStatus : null;
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

	const [conversationsResult, workroomResult] = await Promise.all([
		getUserConversations(supabase, user.id),
		getWorkroomDetailForParticipant(supabase, user.id, id),
	]);

	if (conversationsResult.error) {
		throw new Error(conversationsResult.error);
	}

	if (workroomResult.error) {
		throw new Error(workroomResult.error);
	}

	if (!workroomResult.data) {
		notFound();
	}

	const workroom = workroomResult.data;
	const viewerRole = workroom.client_id === user.id ? "client" : "provider";
	const otherParty = viewerRole === "client" ? workroom.provider : workroom.client;
	const otherPartyLabel = viewerRole === "client" ? "Provider" : "Client";
	const listPath =
		viewerRole === "client"
			? "/dashboard/client/workrooms"
			: "/dashboard/provider/workrooms";
	const unreadConversations =
		conversationsResult.data?.filter((conversation) => conversation.unread_count > 0) ??
		[];
	const service = workroom.service;
	const serviceRequest = workroom.service_request;
	const detailItems = [
		["Status", workroom.status],
		["Accepted", formatWorkroomDate(workroom.accepted_at)],
		[
			"Completed",
			workroom.completed_at ? formatWorkroomDate(workroom.completed_at) : "Not completed",
		],
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
			title="Workroom"
			subtitle="Agreement summary, participant details, and the active conversation for accepted service work."
			actionHref={listPath}
			actionLabel="Back to Workrooms"
			navItems={[
				{
					href: viewerRole === "client" ? "/dashboard/client" : "/dashboard/provider",
					label: "Overview",
				},
				...(viewerRole === "client"
					? [
							{ href: "/dashboard/client/projects", label: "Projects" },
							{ href: "/dashboard/client/service-requests", label: "Service Requests" },
						]
					: [
							{
								href: "/dashboard/provider/applications",
								label: "Applications",
							},
							{ href: "/dashboard/provider/services", label: "Services" },
							{ href: "/dashboard/provider/service-requests", label: "Service Requests" },
						]),
				{
					href: listPath,
					label: "Workrooms",
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
				<WorkroomNotice status={workroomStatus} error={workroomError} />

				<div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
					<div className="space-y-5">
						<article className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)] sm:p-7">
							<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
								<div className="min-w-0">
									<div className="flex flex-wrap items-center gap-2">
										<WorkroomStatusBadge status={workroom.status} />
										<span className="text-sm font-semibold text-secondary">
											Accepted {formatWorkroomDate(workroom.accepted_at)}
										</span>
									</div>
									<h2 className="mt-4 wrap-break-word text-3xl font-semibold text-black">
										{service?.title ?? "Accepted service"}
									</h2>
								</div>
								<div className="flex shrink-0 flex-wrap gap-2">
									{service ? (
										<Link
											href={`/find-talent/${service.id}`}
											className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-semibold text-black transition hover:bg-black/3"
										>
											View service
										</Link>
									) : null}
									<Link
										href={`/dashboard/service-requests/${workroom.service_request_id}`}
										className="inline-flex min-h-11 items-center justify-center rounded-2xl border border-line px-4 text-sm font-semibold text-black transition hover:bg-black/3"
									>
										View request
									</Link>
								</div>
							</div>

							<div className="mt-7">
								<h3 className="text-lg font-semibold text-black">
									Agreement summary
								</h3>
								<p className="mt-4 whitespace-pre-line wrap-break-word rounded-3xl border border-line bg-panel-soft p-5 text-sm leading-6 text-black/80">
									{serviceRequest?.message ?? "No agreement summary available."}
								</p>
							</div>
						</article>

						<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)] sm:p-7">
							<h3 className="text-lg font-semibold text-black">
								Workroom details
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
								{workroom.conversation_id ? (
									<Link
										href={`/dashboard/messages?conversation=${workroom.conversation_id}`}
										className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-black px-4 text-sm font-semibold text-white transition hover:opacity-90"
									>
										Open conversation
									</Link>
								) : (
									<div className="rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
										Conversation unavailable
									</div>
								)}
								<WorkroomActions
									workroom={workroom}
									viewerRole={viewerRole}
									context={
										viewerRole === "client"
											? "client-workroom-detail"
											: "provider-workroom-detail"
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
