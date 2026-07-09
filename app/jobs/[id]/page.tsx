import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getPublishedProjectByIdForProvider } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { ProviderApplicationForm } from "@/components/projects/provider-application-form";

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

export default async function JobDetailsPage({ params }: PageProps) {
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

	const { id } = await params;
	const projectResult = await getPublishedProjectByIdForProvider(
		supabase,
		user.id,
		id,
	);

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

	return (
		<section className="space-y-8 py-4 sm:py-8">
			<div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
				<Link
					href="/jobs"
					className="font-semibold text-black transition hover:opacity-70"
				>
					Find Work
				</Link>
				<span>/</span>
				<span>{project.title}</span>
			</div>

			<section className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8">
				<div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-4xl">
						<div className="flex flex-wrap items-center gap-3">
							<span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
								Published
							</span>
							<p className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary">
								Project brief
							</p>
						</div>

						<h1 className="mt-4 text-3xl font-semibold text-black sm:text-4xl">
							{project.title}
						</h1>
						<p className="mt-4 wrap-break-words text-sm leading-7 text-secondary sm:text-base">
							{project.description}
						</p>
					</div>

					<div className="flex shrink-0 flex-col gap-3 sm:flex-row lg:flex-col">
						<Link
							href="#apply"
							className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
						>
							Apply to this project
						</Link>
						<Link
							href="/jobs"
							className="inline-flex items-center justify-center rounded-2xl border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/3"
						>
							Back to jobs
						</Link>
					</div>
				</div>
			</section>

			<section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
				<article className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
					<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
						Budget
					</p>
					<p className="mt-3 text-lg font-semibold text-black">
						{formatBudget(
							project.budget_type,
							project.budget_min,
							project.budget_max,
						)}
					</p>
				</article>
				<article className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
					<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
						Deadline
					</p>
					<p className="mt-3 text-lg font-semibold text-black">
						{formatDateLabel(project.deadline_date)}
					</p>
				</article>
				<article className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
					<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
						Scope
					</p>
					<p className="mt-3 text-lg font-semibold text-black">
						{scopeLabel(project.scope_level)}
					</p>
				</article>
				<article className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
					<p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
						Readiness
					</p>
					<p className="mt-3 text-lg font-semibold text-black">
						{readinessLabel(project.readiness_level)}
					</p>
				</article>
			</section>

			<section className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.9fr)]">
				<div className="space-y-6">
					<article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
						<h2 className="text-2xl font-semibold text-black">
							What needs to be done
						</h2>
						<p className="mt-4 wrap-break-words text-sm leading-7 text-secondary sm:text-base">
							{project.what_do_you_need_text ||
								"No implementation details added."}
						</p>
					</article>

					<article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
						<h2 className="text-2xl font-semibold text-black">
							Business context
						</h2>
						<div className="mt-4 space-y-4 wrap-break-words text-sm leading-7 text-secondary sm:text-base">
							<p>
								{project.business_context_text ||
									"No additional business context added."}
							</p>
							{project.business_domain_other_text ? (
								<p>
									<span className="font-semibold text-black">
										Custom domain:
									</span>{" "}
									{project.business_domain_other_text}
								</p>
							) : null}
						</div>
					</article>

					<article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
						<h2 className="text-2xl font-semibold text-black">Fit signals</h2>
						<div className="mt-4 space-y-4 wrap-break-words text-sm leading-7 text-secondary sm:text-base">
							<p>
								<span className="font-semibold text-black">
									Target audience:
								</span>{" "}
								{project.target_audience_text || "Not specified"}
							</p>
							<p>
								<span className="font-semibold text-black">
									Success criteria:
								</span>{" "}
								{project.success_criteria_text || "Not specified"}
							</p>
							<p>
								<span className="font-semibold text-black">
									Discovery notes:
								</span>{" "}
								{project.discovery_notes || "No discovery notes added."}
							</p>
						</div>
					</article>
				</div>

				<div className="space-y-6">
					<article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
						<h2 className="text-2xl font-semibold text-black">Project setup</h2>
						<div className="mt-5 grid gap-3 text-sm text-secondary">
							<p>
								<span className="font-semibold text-black">
									Preferred start:
								</span>{" "}
								{formatDateLabel(project.desired_start_date)}
							</p>
							<p>
								<span className="font-semibold text-black">Needs design:</span>{" "}
								{yesNoLabel(project.needs_design)}
							</p>
							<p>
								<span className="font-semibold text-black">Needs SEO:</span>{" "}
								{yesNoLabel(project.needs_seo)}
							</p>
							<p>
								<span className="font-semibold text-black">Needs content:</span>{" "}
								{yesNoLabel(project.needs_content_writing)}
							</p>
							<p>
								<span className="font-semibold text-black">
									Existing website:
								</span>{" "}
								{project.existing_website_url ? (
									<a
										href={project.existing_website_url}
										target="_blank"
										rel="noreferrer"
										className="font-semibold text-black underline"
									>
										{project.existing_website_url}
									</a>
								) : (
									"Not provided"
								)}
							</p>
						</div>
					</article>

					<article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
						<h2 className="text-2xl font-semibold text-black">
							Client preferences
						</h2>
						<div className="mt-5 grid gap-3 text-sm text-secondary">
							<p>
								<span className="font-semibold text-black">Provider type:</span>{" "}
								{providerTypeLabel(project.preferred_provider_type)}
							</p>
							<p>
								<span className="font-semibold text-black">
									Preferred language:
								</span>{" "}
								{project.preferred_language || "Not specified"}
							</p>
							<p>
								<span className="font-semibold text-black">
									Remote friendly:
								</span>{" "}
								{yesNoLabel(project.is_remote_friendly)}
							</p>
						</div>
					</article>

					<article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
						<h2 className="text-2xl font-semibold text-black">Selections</h2>
						<div className="mt-5 grid gap-4 text-sm text-secondary">
							<div>
								<p className="font-semibold text-black">Goals selected</p>
								<p className="mt-1">
									{project.goal_ids.length > 0
										? `${project.goal_ids.length} selected`
										: "No goals selected"}
								</p>
							</div>
							<div>
								<p className="font-semibold text-black">Features selected</p>
								<p className="mt-1">
									{project.feature_ids.length > 0
										? `${project.feature_ids.length} selected`
										: "No features selected"}
								</p>
							</div>
						</div>
					</article>
				</div>
			</section>

			<section
				id="apply"
				className="scroll-mt-28 rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8"
			>
				<div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
					<div className="max-w-3xl">
						<p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
							Ready to propose?
						</p>
						<h2 className="mt-2 text-2xl font-semibold text-black">
							Apply to this project
						</h2>
						<p className="mt-2 text-sm leading-6 text-secondary">
							Send a focused proposal with your approach, expected price, and
							delivery estimate.
						</p>
					</div>
					<div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-700">
						Application review starts after submission
					</div>
				</div>
				<div className="mt-6 max-w-3xl">
					<ProviderApplicationForm projectId={project.id} />
				</div>
			</section>
		</section>
	);
}
