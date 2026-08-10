import Link from "next/link";
import { notFound } from "next/navigation";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath, type UserRole } from "@/lib/auth/roles";
import { getPublicPublishedProjectById } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProviderApplicationForm } from "@/components/projects/provider-application-form";
import { headerTheme } from "@/theme/header-theme";

type PageProps = {
	params: Promise<{
		id: string;
	}>;
};

function formatDateLabel(value: string | null) {
	if (!value) {
		return "No date set";
	}

	return new Intl.DateTimeFormat("en-US", {
		year: "numeric",
		month: "short",
		day: "2-digit",
	}).format(new Date(value));
}

function formatBudget(
	budgetType: string,
	budgetMin: number | null,
	budgetMax: number | null,
) {
	const formatter = new Intl.NumberFormat("en-US", {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 0,
	});

	if (budgetType === "fixed") {
		if (budgetMin != null) {
			return `Fixed: ${formatter.format(budgetMin)}`;
		}

		if (budgetMax != null) {
			return `Fixed: ${formatter.format(budgetMax)}`;
		}

		return "Fixed budget";
	}

	if (budgetType === "negotiable") {
		return "Negotiable";
	}

	if (budgetMin != null && budgetMax != null) {
		return `${formatter.format(budgetMin)} - ${formatter.format(budgetMax)}`;
	}

	if (budgetMin != null) {
		return `From ${formatter.format(budgetMin)}`;
	}

	if (budgetMax != null) {
		return `Up to ${formatter.format(budgetMax)}`;
	}

	return "Budget not specified";
}

function providerTypeLabel(value: string | null) {
	switch (value) {
		case "freelancer":
			return "Freelancer";
		case "agency":
			return "Agency";
		case "studio":
			return "Studio";
		default:
			return "Any provider";
	}
}

function scopeLabel(value: string | null) {
	switch (value) {
		case "small":
			return "Small scope";
		case "medium":
			return "Medium scope";
		case "large":
			return "Large scope";
		default:
			return "Scope not set";
	}
}

function readinessLabel(value: string | null) {
	switch (value) {
		case "idea_only":
			return "Idea only";
		case "need_guidance":
			return "Needs guidance";
		case "content_ready":
			return "Content ready";
		case "design_ready":
			return "Design ready";
		case "spec_ready":
			return "Spec ready";
		default:
			return "Readiness not set";
	}
}

function yesNoLabel(value: boolean | null) {
	return value ? "Yes" : "No";
}

function deadlineLabel(deadlineType: string, deadlineDate: string | null) {
	if (deadlineType === "asap") {
		return "ASAP";
	}

	return formatDateLabel(deadlineDate);
}

function projectStatusLabel(status: string) {
	return status === "in_discussion" ? "In discussion" : "Open";
}

function projectStatusClasses(status: string) {
	return status === "in_discussion"
		? "bg-amber-50 text-amber-700"
		: "bg-blue-50 text-blue-700";
}

function getProjectTags(project: {
	preferred_provider_type: string | null;
	scope_level: string | null;
	readiness_level: string | null;
	needs_design: boolean;
	needs_seo: boolean;
	needs_content_writing: boolean;
}) {
	return [
		providerTypeLabel(project.preferred_provider_type),
		scopeLabel(project.scope_level),
		readinessLabel(project.readiness_level),
		project.needs_design ? "Design" : null,
		project.needs_seo ? "SEO" : null,
		project.needs_content_writing ? "Content" : null,
	].filter((tag): tag is string => Boolean(tag));
}

export default async function JobDetailsPage({ params }: PageProps) {
	const supabase = await createSupabaseServerClient();
	const {
		data: { user },
	} = await supabase.auth.getUser();

	let role: UserRole | null = null;

	if (user) {
		const provisioned = await ensureUserProfile(supabase, user);
		role = provisioned.role ?? null;
	}

	const { id } = await params;
	const projectResult = await getPublicPublishedProjectById(supabase, id);

	if (projectResult.error === "Project not found.") {
		notFound();
	}

	if (projectResult.error) {
		throw new Error(projectResult.error);
	}

	const project = projectResult.data;

	if (!project) {
		notFound();
	}

	const isProvider = role === "provider";
	const dashboardHref = role ? getDashboardPath(role) : null;
	const projectTags = getProjectTags(project);
	const gradientBackground = `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`;

	return (
		<section className="space-y-6 py-2 ">
			<div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
				<div className="min-w-0 space-y-6">
					<section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-8">
						<div className="flex flex-wrap items-center gap-2">
							<span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary">
								Project brief
							</span>
							<span
								className={`rounded-full px-3 py-1 text-xs font-semibold ${projectStatusClasses(
									project.status,
								)}`}
							>
								{projectStatusLabel(project.status)}
							</span>
						</div>

						<h1 className="mt-4 wrap-break-word text-3xl font-semibold leading-tight text-black sm:text-4xl">
							{project.title}
						</h1>
						<p className="mt-4 wrap-break-word text-sm leading-7 text-secondary sm:text-base">
							{project.description}
						</p>

						<div className="mt-7 grid gap-4 rounded-3xl bg-panel-soft p-5 sm:grid-cols-3">
							<div>
								<p className="text-sm text-secondary">Budget</p>
								<p className="mt-1 text-lg font-semibold text-black">
									{formatBudget(
										project.budget_type,
										project.budget_min,
										project.budget_max,
									)}
								</p>
							</div>
							<div>
								<p className="text-sm text-secondary">Timeline</p>
								<p className="mt-1 text-lg font-semibold text-black">
									{deadlineLabel(project.deadline_type, project.deadline_date)}
								</p>
							</div>
							<div>
								<p className="text-sm text-secondary">Start date</p>
								<p className="mt-1 text-lg font-semibold text-black">
									{formatDateLabel(project.desired_start_date)}
								</p>
							</div>
						</div>
					</section>

					<section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-8">
						<h2 className="text-xl font-semibold text-black">
							Project description
						</h2>
						<div className="mt-4 space-y-4 wrap-break-word text-sm leading-7 text-secondary sm:text-base">
							<p>
								{project.what_do_you_need_text ||
									"No implementation details added."}
							</p>
							{project.business_context_text ? (
								<p>{project.business_context_text}</p>
							) : null}
							{project.discovery_notes ? (
								<p>{project.discovery_notes}</p>
							) : null}
						</div>
					</section>

					<section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-8">
						<h2 className="text-xl font-semibold text-black">
							How you match this brief
						</h2>
						<div className="mt-5 grid gap-4 text-sm text-secondary sm:grid-cols-2">
							<p>
								<span className="font-semibold text-black">Provider type:</span>{" "}
								{providerTypeLabel(project.preferred_provider_type)}
							</p>
							<p>
								<span className="font-semibold text-black">Scope:</span>{" "}
								{scopeLabel(project.scope_level)}
							</p>
							<p>
								<span className="font-semibold text-black">Readiness:</span>{" "}
								{readinessLabel(project.readiness_level)}
							</p>
							<p>
								<span className="font-semibold text-black">Language:</span>{" "}
								{project.preferred_language || "Not specified"}
							</p>
							<p>
								<span className="font-semibold text-black">Remote:</span>{" "}
								{yesNoLabel(project.is_remote_friendly)}
							</p>
							<p>
								<span className="font-semibold text-black">Existing site:</span>{" "}
								{project.existing_website_url ? (
									<a
										href={project.existing_website_url}
										target="_blank"
										rel="noreferrer"
										className="font-semibold text-black underline"
									>
										Provided
									</a>
								) : (
									"Not provided"
								)}
							</p>
						</div>
					</section>

					<section className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-8">
						<h2 className="text-xl font-semibold text-black">
							Skills and expertise
						</h2>
						<div className="mt-5 flex flex-wrap gap-2">
							{projectTags.map((tag) => (
								<span
									key={tag}
									className="max-w-full truncate rounded-full bg-zinc-100 px-4 py-2 text-sm font-semibold text-secondary"
								>
									{tag}
								</span>
							))}
						</div>
						<div className="mt-6 grid gap-3 text-sm text-secondary sm:grid-cols-2">
							<p>
								<span className="font-semibold text-black">
									Goals selected:
								</span>{" "}
								{project.goal_ids.length}
							</p>
							<p>
								<span className="font-semibold text-black">
									Features selected:
								</span>{" "}
								{project.feature_ids.length}
							</p>
						</div>
					</section>
				</div>

				<aside className="xl:sticky xl:top-28 xl:self-start">
					<section
						id="apply"
						className="scroll-mt-28 rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)]"
					>
						<h2 className="text-xl font-semibold text-black">
							{isProvider ? "Submit a proposal" : "Explore this opportunity"}
						</h2>
						<p className="mt-2 text-sm leading-6 text-secondary">
							{isProvider
								? "Include your approach, relevant experience, and why you are a good fit."
								: "Review the brief for free. Sign in with a provider account to submit a proposal."}
						</p>

						<div className="mt-6">
							{isProvider ? (
								<ProviderApplicationForm projectId={project.id} />
							) : user ? (
								<div>
									<p className="rounded-2xl border border-line bg-panel-soft p-4 text-sm leading-6 text-secondary">
										This account can browse project briefs, but only provider
										accounts can submit proposals.
									</p>
									{dashboardHref ? (
										<Link
											href={dashboardHref}
											className="mt-5 inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
											style={{ background: gradientBackground }}
										>
											Go to dashboard
										</Link>
									) : null}
								</div>
							) : (
								<div>
									<Link
										href="/register"
										className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
										style={{ background: gradientBackground }}
									>
										Sign up
									</Link>
									<p className="mt-5 text-center text-sm text-secondary">
										Already have an account?{" "}
										<Link
											href="/login"
											className="font-semibold text-black underline"
										>
											Log in
										</Link>
									</p>
								</div>
							)}
						</div>

						<div className="mt-6 border-t border-line pt-5 text-sm text-secondary">
							<p>Application review starts after submission.</p>
						</div>
					</section>
				</aside>
			</div>
		</section>
	);
}
