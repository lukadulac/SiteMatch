import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ExpandableText } from "@/components/projects/job-detail/expandable-text";
import { Avatar } from "@/components/profile/avatar";
import { CompleteWorkroomButton } from "@/components/workrooms/complete-workroom-button";
import {
	formatWorkroomDate,
	WorkroomNotice,
	WorkroomStatusBadge,
} from "@/components/workrooms/workroom-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
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
		return null;
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

	return `${formattedPrice} fixed`;
}

function partyLocation(party: { city: string | null; country: string | null } | null) {
	return [party?.city, party?.country]
		.filter((value): value is string => Boolean(value))
		.join(", ");
}

function firstName(name: string) {
	return name.split(" ")[0] || name;
}

const cardClasses = "rounded-3xl border border-line bg-white";
const secondaryLinkClasses =
	"inline-flex min-h-11 items-center text-sm text-secondary underline underline-offset-3 hover:text-foreground";

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
	const otherName = otherParty?.full_name ?? otherPartyLabel;
	const otherLocation = partyLocation(otherParty);
	const listPath =
		viewerRole === "client"
			? "/dashboard/client/workrooms"
			: "/dashboard/provider/workrooms";
	const detailPath = `/dashboard/workrooms/${workroom.id}`;
	const conversationHref = workroom.conversation_id
		? `/dashboard/messages?conversation=${workroom.conversation_id}`
		: null;
	const unreadConversations =
		conversationsResult.data?.filter((conversation) => conversation.unread_count > 0) ??
		[];
	const service = workroom.service;
	const isCompleted = workroom.status === "completed";
	const providerCanComplete = viewerRole === "provider" && !isCompleted;
	const clientCanMessage = viewerRole === "client" && !isCompleted && conversationHref;
	const hasActionBar = providerCanComplete || Boolean(clientCanMessage);
	const price = service
		? formatPrice({ priceType: service.price_type, startingPrice: service.starting_price })
		: null;
	const facts = [
		{ label: "Price", value: price },
		{ label: "Delivery", value: service?.delivery_estimate },
		{ label: "Service type", value: service?.service_type_text },
		{ label: "Category", value: service?.category_text },
	].filter((fact): fact is { label: string; value: string } => Boolean(fact.value));
	const statusMessage =
		workroomStatus && isCompleted && viewerRole === "provider"
			? `${workroomStatus} ${firstName(otherName)} will see it as delivered.`
			: workroomStatus;

	return (
		<DashboardShell
			navItems={[
				{
					href: viewerRole === "client" ? "/dashboard/client" : "/dashboard/provider",
					label: "Overview",
				},
				{ href: listPath, label: "Workrooms", active: true },
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadConversations.length,
				},
			]}
		>
			<div className={`space-y-4 sm:space-y-6 ${hasActionBar ? "pb-28 lg:pb-0" : ""}`}>
				<div className="space-y-3">
					<Link
						href={listPath}
						className="inline-flex min-h-11 items-center gap-1.5 text-sm text-secondary hover:text-foreground"
					>
						<svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
							<path d="M15 18l-6-6 6-6" />
						</svg>
						Workrooms
					</Link>
					<WorkroomNotice
						status={statusMessage}
						error={workroomError}
						dismissHref={detailPath}
						retry={
							providerCanComplete ? (
								<CompleteWorkroomButton workroomId={workroom.id} label="Try again" variant="retry" />
							) : null
						}
					/>
				</div>

				<header>
					<WorkroomStatusBadge status={workroom.status} />
					<h1 className="mt-2.5 text-[1.625rem] leading-tight font-bold tracking-[-0.015em] wrap-break-word sm:mt-3 sm:text-[2.125rem] sm:tracking-[-0.02em]">
						{service?.title ?? "Accepted service"}
					</h1>
					<div className="mt-2 flex flex-wrap items-center gap-x-5 text-sm sm:text-[0.9375rem]">
						<p className="text-secondary">
							With <span className="font-semibold text-foreground">{otherName}</span> · Accepted{" "}
							{formatWorkroomDate(workroom.accepted_at)}
						</p>
						<div className="flex gap-4">
							{service ? (
								<Link href={`/find-talent/${service.id}`} className={secondaryLinkClasses}>
									View service
								</Link>
							) : null}
							<Link
								href={`/dashboard/service-requests/${workroom.service_request_id}`}
								className={secondaryLinkClasses}
							>
								View request
							</Link>
						</div>
					</div>
				</header>

				<section
					aria-label={isCompleted ? "Status" : "Next step"}
					className={`${cardClasses} border-line-strong p-4.5 shadow-[0_1px_2px_rgba(17,17,17,0.04)] sm:flex sm:flex-wrap sm:items-center sm:gap-4 sm:px-5.5 sm:py-5`}
				>
					{isCompleted ? (
						<div className="flex items-center gap-3 sm:gap-4">
							<span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-700 sm:size-11">
								<svg aria-hidden="true" className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
									<path d="M5 12.5l4.5 4.5L19 7.5" />
								</svg>
							</span>
							<div>
								<p className="hidden text-[0.8125rem] text-secondary sm:block">Status</p>
								<p className="text-base font-semibold">
									Completed on {formatWorkroomDate(workroom.completed_at ?? workroom.updated_at)}.
								</p>
							</div>
						</div>
					) : (
						<>
							<span aria-hidden="true" className="hidden size-11 shrink-0 items-center justify-center rounded-full bg-panel-strong sm:flex">
								{viewerRole === "provider" ? (
									<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
										<path d="M5 12h14M13 6l6 6-6 6" />
									</svg>
								) : (
									<svg className="size-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
										<circle cx="12" cy="12" r="9" />
										<path d="M12 7v5l3 2" />
									</svg>
								)}
							</span>
							<div className="min-w-0 sm:flex-[1_1_16rem]">
								<p className="text-[0.8125rem] text-secondary">Next step</p>
								<p className="mt-0.5 text-base leading-snug font-semibold">
									{viewerRole === "provider"
										? "When the work is delivered, mark this workroom completed."
										: `${otherName} is working on this. They'll mark it completed when it's delivered.`}
								</p>
							</div>
							<div className="mt-3.5 sm:mt-0">
								{providerCanComplete ? (
									<CompleteWorkroomButton workroomId={workroom.id} />
								) : clientCanMessage ? (
									<Link
										href={clientCanMessage}
										className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-black px-5 text-[0.9375rem] font-semibold text-white transition hover:bg-zinc-800 sm:w-auto"
									>
										Message {otherName}
									</Link>
								) : null}
							</div>
						</>
					)}
				</section>

				<div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
					<section
						aria-labelledby="agreed-heading"
						className={`${cardClasses} min-w-0 p-5 lg:flex-1 lg:rounded-[1.75rem] lg:px-7.5 lg:py-7`}
					>
						<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
							<h2 id="agreed-heading" className="text-lg font-semibold lg:text-xl">
								What was agreed
							</h2>
							<p className="text-[0.8125rem] text-secondary">
								{viewerRole === "provider"
									? `From ${firstName(otherName)}’s request`
									: "From your request"}
							</p>
						</div>
						<div className="mt-3 lg:mt-3.5">
							<ExpandableText
								text={workroom.service_request?.message ?? "No agreement summary available."}
							/>
						</div>
						{facts.length > 0 ? (
							<dl className="mt-4 grid grid-cols-2 gap-2 lg:mt-5 lg:grid-cols-4 lg:gap-2.5">
								{facts.map((fact) => (
									<div key={fact.label} className="min-w-0 rounded-2xl bg-panel-soft px-3.5 py-3">
										<dt className="text-xs text-secondary lg:text-[0.8125rem]">{fact.label}</dt>
										<dd className="mt-1 text-[0.9375rem] font-semibold wrap-break-word">{fact.value}</dd>
									</div>
								))}
							</dl>
						) : null}
					</section>

					<aside
						aria-label="Participant and conversation"
						className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-28 lg:w-80 lg:shrink-0"
					>
						<section aria-labelledby="party-heading" className={`${cardClasses} p-4.5 lg:p-5.5`}>
							<h2 id="party-heading" className="text-xs text-secondary lg:mb-3.5 lg:text-sm lg:font-semibold">
								{otherPartyLabel}
							</h2>
							<div className="flex items-center gap-3 lg:gap-3.5">
								<Avatar name={otherName} avatarPath={otherParty?.avatar_url} size="lg" />
								<div className="min-w-0 flex-1">
									<p className="truncate text-[0.9375rem] font-semibold lg:text-[1.0625rem]">{otherName}</p>
									{otherLocation ? (
										<p className="truncate text-[0.8125rem] text-secondary lg:mt-0.5 lg:text-sm">{otherLocation}</p>
									) : null}
								</div>
								{otherParty ? (
									<Link
										href={`/profiles/${otherParty.id}`}
										className="py-3 text-sm font-semibold underline underline-offset-3 hover:text-secondary lg:hidden"
									>
										View profile
									</Link>
								) : null}
							</div>
							{otherParty ? (
								<Link
									href={`/profiles/${otherParty.id}`}
									className="mt-4 hidden min-h-11 items-center justify-center rounded-2xl border border-line-strong text-sm font-semibold transition hover:bg-black/3 lg:flex"
								>
									View profile
								</Link>
							) : null}
						</section>

						<section aria-labelledby="conversation-heading" className={`${cardClasses} p-5 lg:p-5.5`}>
							<h2 id="conversation-heading" className="text-base font-semibold">
								Conversation
							</h2>
							{conversationHref ? (
								<>
									<p className="mt-1 text-sm leading-normal text-secondary lg:mt-1.5">
										Your messages with {otherName} about this hire.
									</p>
									<Link
										href={conversationHref}
										className="mt-3.5 flex min-h-12 items-center justify-center rounded-2xl border border-line-strong bg-white text-[0.9375rem] font-semibold transition hover:bg-black/3 lg:mt-4 lg:border-0 lg:bg-black lg:text-white lg:hover:bg-zinc-800"
									>
										Open conversation
									</Link>
								</>
							) : (
								<p className="mt-2 flex items-center gap-2 text-sm text-secondary">
									<svg aria-hidden="true" className="size-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
										<circle cx="12" cy="12" r="9" />
										<path d="M12 11v5.5M12 7.5h.01" />
									</svg>
									Conversation unavailable
								</p>
							)}
						</section>
					</aside>
				</div>
			</div>

			{hasActionBar ? (
				<div className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-white px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(17,17,17,0.05)] lg:hidden">
					{providerCanComplete ? (
						<CompleteWorkroomButton workroomId={workroom.id} variant="bar" />
					) : clientCanMessage ? (
						<Link
							href={clientCanMessage}
							className="flex min-h-12 items-center justify-center rounded-2xl bg-black px-5 text-base font-semibold text-white"
						>
							Message {otherName}
						</Link>
					) : null}
				</div>
			) : null}
		</DashboardShell>
	);
}
