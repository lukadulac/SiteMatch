import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteProviderServiceListingAction } from "@/app/dashboard/provider/services/actions";
import { DashboardPanel, DashboardShell } from "@/components/dashboard/DashboardShell";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
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
	searchParams?: Promise<{ serviceError?: string | string[] }>;
}) {
	const params = await searchParams;
	const serviceError =
		typeof params?.serviceError === "string" ? params.serviceError : null;
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

	const [conversationsResult, applicationsResult, servicesResult] =
		await Promise.all([
			getUserConversations(supabase, user.id),
			supabase
				.from("applications")
				.select("id")
				.eq("provider_id", user.id),
			supabase
				.from("provider_service_listings")
				.select(
					"id, title, description, status, price_type, starting_price, delivery_estimate, service_type_text, category_text, created_at",
				)
				.eq("provider_id", user.id)
				.order("created_at", { ascending: false }),
		]);

	if (conversationsResult.error) {
		throw new Error(conversationsResult.error);
	}

	if (applicationsResult.error) {
		throw new Error(applicationsResult.error.message);
	}

	if (servicesResult.error) {
		throw new Error(servicesResult.error.message);
	}

	const unreadConversations =
		conversationsResult.data?.filter((conversation) => conversation.unread_count > 0) ??
		[];
	const applications = applicationsResult.data ?? [];
	const services = servicesResult.data ?? [];

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
					count: applications.length,
				},
				{
					href: "/dashboard/provider/services",
					label: "Services",
					count: services.length,
					active: true,
				},
				{
					href: "/dashboard/messages",
					label: "Messages",
					count: unreadConversations.length,
				},
				{ href: "/dashboard/provider/profile", label: "Profile" },
			]}
		>
			<DashboardPanel title="My Services">
				{serviceError ? (
					<div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
						{serviceError}
					</div>
				) : null}
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
											<button
												type="submit"
												className="rounded-2xl border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
											>
												Delete
											</button>
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
						<h2 className="text-2xl font-semibold text-black">
							No services posted yet
						</h2>
						<p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-secondary">
							Post your first service so clients can understand what you offer
							before the public Find Talent page goes live.
						</p>
						<Link
							href="/dashboard/provider/services/post"
							className="mt-6 inline-flex min-h-11 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
						>
							Post Service
						</Link>
					</div>
				)}
			</DashboardPanel>
		</DashboardShell>
	);
}
