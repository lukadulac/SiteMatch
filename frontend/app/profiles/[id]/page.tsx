import {
	ArrowLeft,
	ArrowRight,
	CalendarDays,
	MapPin,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { Avatar } from "@/components/profile/avatar";
import {
	getPublicProfile,
	type PublicClientProfile,
	type PublicProfile,
	type PublicProviderProfile,
} from "@/lib/profiles/public-profile";
import {
	availabilityMeta,
	formatMemberSince,
	formatProjectBudget,
	getClientBusinessType,
	getProfileDisplayName,
	getProfileLocation,
	getProviderDisciplines,
	getProviderRates,
	getProviderRoleLine,
	splitTextList,
} from "@/lib/profiles/public-profile-view";
import {
	getPublicPublishedProjects,
	type ProviderProjectSummary,
} from "@/lib/projects/service";
import {
	formatProviderServicePrice,
	getCategoryLabel,
	priceTypeLabel,
} from "@/lib/provider-services/formatters";
import {
	getPublicPublishedProviderServices,
	type PublicProviderServiceListing,
} from "@/lib/provider-services/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headerTheme } from "@/theme/header-theme";

type PublicProfilePageProps = {
	params: Promise<{ id: string }>;
};

const LISTING_LIMIT = 6;

const cardClass =
	"rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-7";

const availabilityToneClasses = {
	emerald: "bg-emerald-50 text-emerald-700",
	amber: "bg-amber-50 text-amber-700",
	zinc: "bg-zinc-100 text-zinc-600",
} as const;

const gradientStyle = {
	background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
};

export default async function PublicProfilePage({
	params,
}: PublicProfilePageProps) {
	const { id } = await params;
	const supabase = await createSupabaseServerClient();
	const [
		profileResult,
		{
			data: { user },
		},
	] = await Promise.all([getPublicProfile(supabase, id), supabase.auth.getUser()]);

	if ("error" in profileResult) {
		throw new Error(profileResult.error);
	}

	const profile = profileResult.data;

	if (!profile) {
		notFound();
	}

	const isOwnProfile = user?.id === profile.id;

	if (profile.role === "provider") {
		const servicesResult = await getPublicPublishedProviderServices(supabase, {
			providerId: profile.id,
			page: 1,
			pageSize: LISTING_LIMIT,
		});

		if (!servicesResult.data) {
			throw new Error(servicesResult.error);
		}

		return (
			<ProviderProfileView
				profile={profile}
				services={servicesResult.data.services}
				totalServices={servicesResult.data.totalCount}
				isOwnProfile={isOwnProfile}
			/>
		);
	}

	const projectsResult = await getPublicPublishedProjects(supabase, {
		clientId: profile.id,
	});

	if (!projectsResult.data) {
		throw new Error(projectsResult.error);
	}

	return (
		<ClientProfileView
			profile={profile}
			projects={projectsResult.data}
			isOwnProfile={isOwnProfile}
		/>
	);
}

function ProviderProfileView({
	profile,
	services,
	totalServices,
	isOwnProfile,
}: {
	profile: PublicProviderProfile;
	services: PublicProviderServiceListing[];
	totalServices: number;
	isOwnProfile: boolean;
}) {
	const details = profile.provider;
	const about = details?.about?.trim() || details?.bio?.trim() || null;
	const disciplines = getProviderDisciplines(profile);
	const techStack = splitTextList(details?.tech_capabilities_text ?? null);
	const industries = splitTextList(details?.industries_text ?? null);
	const rates = getProviderRates(profile);
	const availability = details ? availabilityMeta[details.availability] : null;
	const stats = [
		{ label: "Jobs won", value: profile.stats.jobs_won },
		{
			label: "Collaborations completed",
			value: profile.stats.collaborations_completed,
		},
		...(details?.years_of_experience != null
			? [{ label: "Years of experience", value: details.years_of_experience }]
			: []),
		...(details?.team_size != null && details.team_size > 1
			? [{ label: "Team size", value: details.team_size }]
			: []),
	];

	return (
		<ProfileLayout
			backHref="/find-talent"
			backLabel="Back to Find Talent"
			hero={
				<ProfileHero
					profile={profile}
					badge="Provider"
					roleLine={getProviderRoleLine(profile)}
					headline={details?.headline?.trim() || null}
					status={
						availability ? (
							<span
								className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold ${availabilityToneClasses[availability.tone]}`}
							>
								<span className="size-1.5 rounded-full bg-current" />
								{availability.label}
							</span>
						) : null
					}
					primaryAction={
						isOwnProfile
							? { label: "Edit profile", href: "/dashboard/provider/profile" }
							: services.length > 0
								? { label: "Browse services", href: "#services" }
								: { label: "Find more talent", href: "/find-talent" }
					}
				/>
			}
			main={
				<>
					<section className={cardClass}>
						<h2 className="text-lg font-semibold text-black">About</h2>
						{about ? (
							<p className="mt-4 whitespace-pre-line wrap-break-word text-base leading-8 text-black/80">
								{about}
							</p>
						) : (
							<p className="mt-4 text-sm text-secondary">
								This provider hasn&apos;t written an introduction yet.
							</p>
						)}
					</section>

					<section id="services" className={`${cardClass} scroll-mt-28`}>
						<SectionHeading
							title="Published services"
							subtitle="Ready-to-book services from this provider."
							count={totalServices}
						/>
						{services.length > 0 ? (
							<div className="mt-5 grid gap-3 sm:grid-cols-2">
								{services.map((service) => (
									<ServiceCard key={service.id} service={service} />
								))}
							</div>
						) : (
							<EmptyState>No services published yet.</EmptyState>
						)}
					</section>

					{disciplines.length > 0 || techStack.length > 0 || industries.length > 0 ? (
						<section className={cardClass}>
							<h2 className="text-lg font-semibold text-black">Expertise</h2>
							<div className="mt-5 space-y-5">
								<ChipGroup title="Specialized disciplines" items={disciplines} />
								<ChipGroup title="Tech stack & tools" items={techStack} />
								<ChipGroup title="Industries" items={industries} />
							</div>
						</section>
					) : null}
				</>
			}
			aside={
				<>
					<StatsCard title="Track record" stats={stats} />
					{rates.length > 0 ? (
						<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)]">
							<h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
								Rates
							</h2>
							<dl className="mt-4 space-y-3">
								{rates.map((rate) => (
									<div
										key={rate.label}
										className="flex items-baseline justify-between gap-3 border-b border-line pb-3 last:border-0 last:pb-0"
									>
										<dt className="text-sm text-secondary">{rate.label}</dt>
										<dd className="text-right text-sm font-semibold text-black">
											{rate.value}
										</dd>
									</div>
								))}
							</dl>
						</section>
					) : null}
				</>
			}
		/>
	);
}

function ClientProfileView({
	profile,
	projects,
	isOwnProfile,
}: {
	profile: PublicClientProfile;
	projects: ProviderProjectSummary[];
	isOwnProfile: boolean;
}) {
	const details = profile.client;
	const businessType = getClientBusinessType(profile);
	const businessName = details?.business_name?.trim() || null;
	const targetMarket = details?.target_market_text?.trim() || null;
	const visibleProjects = projects.slice(0, LISTING_LIMIT);
	const stats = [
		{ label: "Projects posted", value: profile.stats.projects_posted },
		{ label: "Hires", value: profile.stats.hires },
	];

	return (
		<ProfileLayout
			backHref="/jobs"
			backLabel="Back to Find Work"
			hero={
				<ProfileHero
					profile={profile}
					badge="Client"
					roleLine={[businessName, businessType].filter(Boolean).join(" · ") || "Client"}
					headline={null}
					status={null}
					primaryAction={
						isOwnProfile
							? { label: "Edit profile", href: "/dashboard/client/profile" }
							: projects.length > 0
								? { label: "Browse open projects", href: "#projects" }
								: { label: "Find more work", href: "/jobs" }
					}
				/>
			}
			main={
				<>
					<section className={cardClass}>
						<h2 className="text-lg font-semibold text-black">
							{businessName ? `About ${businessName}` : "About"}
						</h2>
						{details?.business_description?.trim() ? (
							<p className="mt-4 whitespace-pre-line wrap-break-word text-base leading-8 text-black/80">
								{details.business_description.trim()}
							</p>
						) : (
							<p className="mt-4 text-sm text-secondary">
								This client hasn&apos;t described their business yet.
							</p>
						)}
					</section>

					<section id="projects" className={`${cardClass} scroll-mt-28`}>
						<SectionHeading
							title="Projects seeking providers"
							subtitle="Open projects you can apply to."
							count={projects.length}
						/>
						{visibleProjects.length > 0 ? (
							<div className="mt-5 grid gap-3">
								{visibleProjects.map((project) => (
									<ProjectCard key={project.id} project={project} />
								))}
							</div>
						) : (
							<EmptyState>No open projects right now.</EmptyState>
						)}
					</section>
				</>
			}
			aside={
				<>
					<StatsCard title="Hiring activity" stats={stats} />
					{businessType || details?.company_size || targetMarket ? (
						<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)]">
							<h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
								Business
							</h2>
							<dl className="mt-4 space-y-3">
								{[
									["Industry", businessType],
									["Company size", details?.company_size?.trim() || null],
									["Target market", targetMarket],
								]
									.filter((row): row is [string, string] => Boolean(row[1]))
									.map(([label, value]) => (
										<div
											key={label}
											className="border-b border-line pb-3 last:border-0 last:pb-0"
										>
											<dt className="text-xs font-semibold text-secondary">{label}</dt>
											<dd className="mt-1 wrap-break-word text-sm font-semibold text-black">
												{value}
											</dd>
										</div>
									))}
							</dl>
						</section>
					) : null}
				</>
			}
		/>
	);
}

function ProfileLayout({
	backHref,
	backLabel,
	hero,
	main,
	aside,
}: {
	backHref: string;
	backLabel: string;
	hero: ReactNode;
	main: ReactNode;
	aside: ReactNode;
}) {
	return (
		<section className="space-y-5 py-4 sm:py-8">
			<Link
				href={backHref}
				className="inline-flex items-center gap-1.5 text-sm font-semibold text-secondary transition hover:text-black"
			>
				<ArrowLeft className="size-4" aria-hidden="true" />
				{backLabel}
			</Link>

			{hero}

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				<div className="min-w-0 space-y-5">{main}</div>
				<aside className="space-y-4 lg:sticky lg:top-28 lg:self-start">{aside}</aside>
			</div>
		</section>
	);
}

function ProfileHero({
	profile,
	badge,
	roleLine,
	headline,
	status,
	primaryAction,
}: {
	profile: PublicProfile;
	badge: string;
	roleLine: string;
	headline: string | null;
	status: ReactNode;
	primaryAction: { label: string; href: string };
}) {
	const name = getProfileDisplayName(profile);
	const location = getProfileLocation(profile);

	return (
		<header className="relative overflow-hidden rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-8">
			<div
				aria-hidden="true"
				className="pointer-events-none absolute inset-x-0 top-0 h-24 opacity-10"
				style={gradientStyle}
			/>
			<div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
				<div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
					<Avatar
						name={profile.full_name}
						avatarPath={profile.avatar_url}
						size="xl"
						className="ring-4 ring-white shadow-[0_8px_24px_rgba(17,17,17,0.12)]"
					/>
					<div className="min-w-0">
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-violet-700">
								{badge}
							</span>
							{status}
						</div>
						<h1 className="mt-3 wrap-break-word text-3xl font-semibold leading-tight text-black sm:text-4xl">
							{name}
						</h1>
						<p className="mt-1 wrap-break-word text-base font-semibold text-violet-700">
							{roleLine}
						</p>
						{headline ? (
							<p className="mt-2 wrap-break-word text-sm leading-6 text-black/75">
								{headline}
							</p>
						) : null}
						<div className="mt-3 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-secondary">
							{location ? (
								<span className="inline-flex items-center gap-1.5">
									<MapPin className="size-4" aria-hidden="true" />
									{location}
								</span>
							) : null}
							<span className="inline-flex items-center gap-1.5">
								<CalendarDays className="size-4" aria-hidden="true" />
								Member since {formatMemberSince(profile.member_since)}
							</span>
						</div>
					</div>
				</div>

				<Link
					href={primaryAction.href}
					className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
					style={gradientStyle}
				>
					{primaryAction.label}
					<ArrowRight className="size-4" aria-hidden="true" />
				</Link>
			</div>
		</header>
	);
}

function SectionHeading({
	title,
	subtitle,
	count,
}: {
	title: string;
	subtitle: string;
	count: number;
}) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div>
				<h2 className="text-lg font-semibold text-black">{title}</h2>
				<p className="mt-1 text-sm text-secondary">{subtitle}</p>
			</div>
			{count > 0 ? (
				<span className="rounded-full bg-panel-soft px-3 py-1 text-xs font-semibold text-secondary">
					{count} {count === 1 ? "listing" : "listings"}
				</span>
			) : null}
		</div>
	);
}

function ServiceCard({ service }: { service: PublicProviderServiceListing }) {
	return (
		<Link
			href={`/find-talent/${service.id}`}
			className="group flex flex-col rounded-2xl border border-line bg-panel-soft p-4 transition hover:border-violet-200 hover:bg-white"
		>
			<span className="text-xs font-semibold text-secondary">
				{getCategoryLabel(service)}
			</span>
			<h3 className="mt-2 line-clamp-2 wrap-break-word font-semibold text-black">
				{service.title}
			</h3>
			<div className="mt-auto flex items-end justify-between gap-3 pt-4">
				<div>
					<p className="text-sm font-semibold text-black">
						{formatProviderServicePrice(service)}
					</p>
					<p className="text-xs text-secondary">
						{priceTypeLabel(service.price_type)} · {service.delivery_estimate ?? "Flexible delivery"}
					</p>
				</div>
				<ArrowRight
					className="size-4 shrink-0 text-secondary transition group-hover:translate-x-0.5 group-hover:text-violet-700"
					aria-hidden="true"
				/>
			</div>
		</Link>
	);
}

function ProjectCard({ project }: { project: ProviderProjectSummary }) {
	return (
		<Link
			href={`/jobs/${project.id}`}
			className="group flex flex-col gap-3 rounded-2xl border border-line bg-panel-soft p-4 transition hover:border-violet-200 hover:bg-white sm:flex-row sm:items-center sm:justify-between"
		>
			<div className="min-w-0">
				<span
						className={`w-fit rounded-full px-2.5 py-0.5 text-xs font-semibold ${
							project.status === "in_discussion"
								? "bg-amber-50 text-amber-700"
								: "bg-emerald-50 text-emerald-700"
						}`}
					>
						{project.status === "in_discussion" ? "In discussion" : "Open for proposals"}
					</span>
				<h3 className="mt-2 wrap-break-word font-semibold text-black">{project.title}</h3>
				<p className="mt-1 line-clamp-2 wrap-break-word text-sm text-secondary">
					{project.description}
				</p>
			</div>
			<div className="flex shrink-0 items-center gap-3 sm:flex-col sm:items-end">
				<span className="text-sm font-semibold text-black">
					{formatProjectBudget(project.budget_type, project.budget_min, project.budget_max)}
				</span>
				<ArrowRight
					className="size-4 text-secondary transition group-hover:translate-x-0.5 group-hover:text-violet-700"
					aria-hidden="true"
				/>
			</div>
		</Link>
	);
}

function StatsCard({
	title,
	stats,
}: {
	title: string;
	stats: Array<{ label: string; value: number }>;
}) {
	return (
		<section className="rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.06)]">
			<h2 className="text-xs font-semibold uppercase tracking-wide text-secondary">
				{title}
			</h2>
			<dl className="mt-4 grid grid-cols-2 gap-3">
				{stats.map((stat) => (
					<div
						key={stat.label}
						className="flex flex-col-reverse justify-end rounded-2xl bg-panel-soft p-4"
					>
						<dt className="mt-1 text-xs leading-4 text-secondary">{stat.label}</dt>
						<dd className="text-2xl font-semibold text-black">{stat.value}</dd>
					</div>
				))}
			</dl>
		</section>
	);
}

function ChipGroup({ title, items }: { title: string; items: string[] }) {
	if (items.length === 0) {
		return null;
	}

	return (
		<div>
			<h3 className="text-xs font-semibold uppercase tracking-wide text-secondary">
				{title}
			</h3>
			<ul className="mt-2 flex flex-wrap gap-2">
				{items.map((item) => (
					<li
						key={item}
						className="rounded-full border border-line bg-panel-soft px-3 py-1 text-sm text-black"
					>
						{item}
					</li>
				))}
			</ul>
		</div>
	);
}

function EmptyState({ children }: { children: ReactNode }) {
	return (
		<p className="mt-5 rounded-2xl border border-dashed border-line-strong bg-panel-soft px-4 py-6 text-center text-sm text-secondary">
			{children}
		</p>
	);
}
