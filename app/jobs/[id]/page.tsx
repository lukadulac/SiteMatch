import { notFound } from "next/navigation";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { JobBrief } from "@/components/projects/job-detail/job-brief";
import { JobHeader } from "@/components/projects/job-detail/job-header";
import { MobileApplyBar } from "@/components/projects/job-detail/mobile-apply-bar";
import { PostedByCard } from "@/components/projects/job-detail/posted-by-card";
import {
	ProposalPanel,
	type ProposalViewer,
} from "@/components/projects/job-detail/proposal-panel";
import {
	formatBudget,
	formatDate,
	formatDeadline,
} from "@/components/projects/job-detail/format";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getLoginHref } from "@/lib/auth/return-url";
import { getDashboardPath, type UserRole } from "@/lib/auth/roles";
import { getPublicProfile } from "@/lib/profiles/public-profile";
import {
	getProviderApplicationForProject,
	getPublicPublishedProjectById,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type PageProps = {
	params: Promise<{
		id: string;
	}>;
	searchParams: Promise<{
		applicationError?: string;
		applicationStatus?: string;
	}>;
};

function Notice({ tone, message }: { tone: "success" | "error"; message: string }) {
	const success = tone === "success";
	const Icon = success ? CheckCircle2 : AlertCircle;

	return (
		<div
			role={success ? "status" : "alert"}
			className={`mb-7 flex items-center gap-3.5 rounded-3xl border bg-panel px-5 py-4 ${
				success ? "border-emerald-700/25" : "border-red-700/25"
			}`}
		>
			<span
				className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
					success ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
				}`}
			>
				<Icon aria-hidden="true" className="size-5" />
			</span>
			<p className="text-[0.9375rem] font-semibold text-foreground">{message}</p>
		</div>
	);
}

export default async function JobDetailsPage({ params, searchParams }: PageProps) {
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
	const query = await searchParams;
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
	const [clientResult, applicationResult] = await Promise.all([
		getPublicProfile(supabase, project.client_id),
		user && isProvider
			? getProviderApplicationForProject(supabase, user.id, project.id)
			: Promise.resolve(null),
	]);

	if (applicationResult?.error) {
		throw new Error(applicationResult.error);
	}

	// The brief is still worth showing when its author's profile can't be loaded.
	const client = "data" in clientResult ? clientResult.data : null;
	const viewer: ProposalViewer = !user
		? { kind: "visitor", loginHref: getLoginHref(`/jobs/${project.id}`) }
		: isProvider
			? { kind: "provider", application: applicationResult?.data ?? null }
			: { kind: "client", dashboardHref: role ? getDashboardPath(role) : null };
	const budget = formatBudget(project.budget_type, project.budget_min, project.budget_max);
	const applyLabel =
		viewer.kind === "visitor"
			? "Sign up to apply"
			: viewer.kind === "provider" && !viewer.application
				? "Submit proposal"
				: null;

	return (
		<section className={`py-2 ${applyLabel ? "pb-28 lg:pb-2" : ""}`}>
			{query.applicationStatus ? (
				<Notice tone="success" message={query.applicationStatus} />
			) : null}
			{query.applicationError ? <Notice tone="error" message={query.applicationError} /> : null}

			<JobHeader
				title={project.title}
				status={project.status}
				category={project.service_type_name}
				postedAt={formatDate(project.created_at)}
				isRemoteFriendly={project.is_remote_friendly}
				language={project.preferred_language}
				budget={budget}
				deadline={formatDeadline(project.deadline_type, project.deadline_date)}
				startDate={formatDate(project.desired_start_date)}
			/>

			<div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
				<JobBrief project={project} />

				<aside
					aria-label="Client and proposal"
					className="flex min-w-0 flex-col gap-4 lg:sticky lg:top-28"
				>
					{client ? <PostedByCard client={client} /> : null}
					<div id="apply" className="scroll-mt-28">
						<ProposalPanel projectId={project.id} viewer={viewer} />
					</div>
				</aside>
			</div>

			{applyLabel ? <MobileApplyBar budget={budget} label={applyLabel} /> : null}
		</section>
	);
}
