import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath, type UserRole } from "@/lib/auth/roles";
import {
	formatProviderServicePrice,
	getCategoryLabel,
	getServiceTypeLabel,
	priceTypeLabel,
	providerLocation,
} from "@/lib/provider-services/formatters";
import {
	getPublicProviderServiceById,
	type PublicProviderServiceListing,
} from "@/lib/provider-services/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headerTheme } from "@/theme/header-theme";

type FindTalentServicePageProps = {
	params: Promise<{ id: string }>;
};

function formatPublishedDate(value: string | null) {
	if (!value) {
		return "Available now";
	}

	return new Intl.DateTimeFormat("en-US", {
		month: "short",
		day: "2-digit",
		year: "numeric",
	}).format(new Date(value));
}

function getCta({
	role,
	userId,
	service,
	dashboardHref,
}: {
	role: UserRole | null;
	userId: string | null;
	service: PublicProviderServiceListing;
	dashboardHref: string | null;
}) {
	if (!role) {
		return {
			label: "Sign in to request this service",
			href: "/login",
			disabled: false,
		};
	}

	if (role === "provider" && userId === service.provider_id) {
		return {
			label: "Edit service",
			href: `/dashboard/provider/services/${service.id}`,
			disabled: false,
		};
	}

	if (role === "client") {
		return {
			label: "Request service soon",
			href: dashboardHref ?? "/dashboard/client",
			disabled: true,
		};
	}

	return {
		label: "Service requests are for client accounts",
		href: dashboardHref ?? "/dashboard/provider",
		disabled: true,
	};
}

export default async function FindTalentServicePage({
	params,
}: FindTalentServicePageProps) {
	const { id } = await params;
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	let role: UserRole | null = null;

	if (user) {
		const provisioned = await ensureUserProfile(supabase, user);
		role = provisioned.role ?? null;
	}

	const serviceResult = await getPublicProviderServiceById(supabase, id);

	if (serviceResult.error) {
		notFound();
	}

	const service = serviceResult.data;

	if (!service) {
		notFound();
	}

	const dashboardHref = role ? getDashboardPath(role) : null;
	const cta = getCta({
		role,
		userId: user?.id ?? null,
		service,
		dashboardHref,
	});
	const location = providerLocation(service);

	const detailItems = [
		["Service type", getServiceTypeLabel(service)],
		["Category", getCategoryLabel(service)],
		["Pricing model", priceTypeLabel(service.price_type)],
		["Delivery estimate", service.delivery_estimate ?? "Flexible"],
		["Location", location || "Remote worldwide"],
		["Availability", formatPublishedDate(service.published_at)],
	];

	return (
		<section className="space-y-5 py-4 sm:py-8">
			<div className="flex flex-wrap items-center gap-2 text-sm text-secondary">
				<Link
					href="/find-talent"
					className="font-semibold text-black transition hover:opacity-70"
				>
					Find Talent
				</Link>
				<span>/</span>
				<span className="wrap-break-word">{service.title}</span>
			</div>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
				<div className="space-y-5">
					<article className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-7">
						<div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
							<span className="w-fit rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
								Available
							</span>
							<span className="min-w-0 wrap-break-word text-xs font-medium text-secondary sm:text-right">
								{priceTypeLabel(service.price_type)} service ·{" "}
								{getCategoryLabel(service)}
							</span>
						</div>

						<h1 className="mt-5 wrap-break-word text-3xl font-semibold leading-tight text-black sm:text-4xl">
							{service.title}
						</h1>

						<div className="mt-6 flex flex-wrap items-center gap-3 border-b border-line pb-6">
							<div className="flex h-11 w-11 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-pink-100 text-sm font-bold text-violet-700">
								{service.provider?.full_name?.slice(0, 1) ?? "P"}
							</div>
							<div>
								<p className="font-semibold text-black">
									{service.provider?.full_name ?? "Provider"}
								</p>
								<p className="text-sm text-secondary">
									{location || "Remote provider"}
								</p>
							</div>
						</div>

						<div className="mt-7">
							<h2 className="text-lg font-semibold text-black">
								About this service
							</h2>
							<p className="mt-4 whitespace-pre-line wrap-break-word text-base leading-8 text-black/80">
								{service.description}
							</p>
						</div>
					</article>

					<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-7">
						<h2 className="text-lg font-semibold text-black">Service details</h2>
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

					<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-7">
						<div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
							<div className="flex min-w-0 items-center gap-3">
								<div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-linear-to-br from-violet-100 to-pink-100 text-sm font-bold text-violet-700">
									{service.provider?.full_name?.slice(0, 1) ?? "P"}
								</div>
								<div className="min-w-0">
									<p className="wrap-break-word font-semibold text-black">
										{service.provider?.full_name ?? "Provider"}
									</p>
									<p className="text-sm text-secondary">
										{location || "Remote provider"}
									</p>
								</div>
							</div>
							<button
								type="button"
								disabled
								className="inline-flex min-h-10 items-center justify-center rounded-2xl border border-line bg-white px-4 text-sm font-semibold text-secondary"
							>
								View provider profile
							</button>
						</div>
						<p className="mt-5 text-sm leading-6 text-secondary">
							Independent provider focused on clear, useful digital outcomes. A
							full provider profile and portfolio will appear here soon.
						</p>
					</section>
				</div>

				<aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">
					<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)]">
						<p className="text-sm font-semibold text-secondary">Service price</p>
						<p className="mt-2 text-3xl font-semibold text-black">
							{formatProviderServicePrice(service)}
						</p>
						<p className="mt-1 text-xs font-semibold text-secondary">
							{priceTypeLabel(service.price_type)}
						</p>
						<p className="mt-2 text-sm text-secondary">
							Delivery: {service.delivery_estimate ?? "Flexible"}
						</p>
						<p className="mt-4 border-t border-line pt-4 text-sm leading-6 text-secondary">
							Share your goals with no obligation. Payment and project details
							are confirmed only after the provider responds.
						</p>

						{cta.disabled ? (
							<div className="mt-5 rounded-2xl border border-line bg-panel-soft px-4 py-3 text-sm font-semibold text-secondary">
								{cta.label}
							</div>
						) : (
							<Link
								href={cta.href}
								className="mt-5 inline-flex min-h-11 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
								style={{
									background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
								}}
							>
								{cta.label}
							</Link>
						)}
					</section>
				</aside>
			</div>
		</section>
	);
}
