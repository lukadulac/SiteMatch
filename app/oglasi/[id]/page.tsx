import Link from "next/link";
import { redirect } from "next/navigation";
import { updateClientApplicationStatusAction } from "@/app/oglasi/actions";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import {
  getClientProjectById,
  getProjectApplicationsForClient,
} from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

  return "Budget not set";
}

function statusLabel(status: string) {
  switch (status) {
    case "published":
      return "Published";
    case "in_discussion":
      return "In discussion";
    case "assigned":
      return "Assigned";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    default:
      return "Draft";
  }
}

function statusClasses(status: string) {
  switch (status) {
    case "published":
      return "bg-blue-50 text-blue-700";
    case "in_discussion":
      return "bg-amber-50 text-amber-700";
    case "assigned":
      return "bg-emerald-50 text-emerald-700";
    case "completed":
      return "bg-violet-50 text-violet-700";
    case "cancelled":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function applicationStatusLabel(status: string) {
  switch (status) {
    case "pending":
      return "Pending";
    case "viewed":
      return "Viewed";
    case "shortlisted":
      return "Shortlisted";
    case "accepted":
      return "Accepted";
    case "rejected":
      return "Rejected";
    default:
      return "Withdrawn";
  }
}

function applicationStatusClasses(status: string) {
  switch (status) {
    case "pending":
      return "bg-blue-50 text-blue-700";
    case "viewed":
      return "bg-zinc-100 text-zinc-700";
    case "shortlisted":
      return "bg-amber-50 text-amber-700";
    case "accepted":
      return "bg-emerald-50 text-emerald-700";
    case "rejected":
      return "bg-red-50 text-red-700";
    default:
      return "bg-zinc-100 text-zinc-700";
  }
}

function formatPrice(value: number | null) {
  if (value == null) {
    return "Not specified";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function ListingDetailsPage({ params }: PageProps) {
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

  if (provisioned.role !== "client") {
    redirect(getDashboardPath(provisioned.role));
  }

  const { id } = await params;
  const [projectResult, applicationsResult] = await Promise.all([
    getClientProjectById(supabase, user.id, id),
    getProjectApplicationsForClient(supabase, user.id, id),
  ]);

  if (projectResult.error) {
    throw new Error(projectResult.error);
  }

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error);
  }

  if (!projectResult.data) {
    throw new Error("Project could not be loaded.");
  }

  const project = projectResult.data;
  const applications = applicationsResult.data ?? [];
  const activeApplications = applications.filter(
    (application) =>
      application.status !== "rejected" && application.status !== "withdrawn",
  );

  return (
    <section className="space-y-8 py-4 sm:py-8">
      <div className="flex flex-wrap items-center gap-3 text-sm text-secondary">
        <Link href="/oglasi" className="font-semibold text-black transition hover:opacity-70">
          Client listings
        </Link>
        <span>/</span>
        <span>{project.title}</span>
      </div>

      <section className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="max-w-4xl">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${statusClasses(
                  project.status,
                )}`}
              >
                {statusLabel(project.status)}
              </span>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary">
                Project details
              </p>
            </div>

            <h1 className="mt-4 text-3xl font-semibold text-black sm:text-4xl">
              {project.title}
            </h1>
            <p className="mt-4 text-sm leading-7 text-secondary sm:text-base">
              {project.description}
            </p>
          </div>

          <Link
            href={`/oglasi/${project.id}/edit`}
            className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
          >
            {project.status === "draft" ? "Continue editing" : "Edit listing"}
          </Link>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <article className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
            Budget
          </p>
          <p className="mt-3 text-lg font-semibold text-black">
            {formatBudget(project.budget_type, project.budget_min, project.budget_max)}
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
            Preferred start
          </p>
          <p className="mt-3 text-lg font-semibold text-black">
            {formatDateLabel(project.desired_start_date)}
          </p>
        </article>
        <article className="rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-secondary">
            Created
          </p>
          <p className="mt-3 text-lg font-semibold text-black">
            {formatDateLabel(project.created_at)}
          </p>
        </article>
      </section>

      <section className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
              Provider applications
            </p>
            <h2 className="mt-2 text-2xl font-semibold text-black">
              Review incoming proposals
            </h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
              Compare provider fit, proposed pricing, and delivery estimates before
              accepting one proposal.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-panel-soft px-4 py-3 text-sm font-semibold text-black">
            {activeApplications.length} active / {applications.length} total
          </div>
        </div>

        <div className="mt-6 space-y-4">
          {applications.length > 0 ? (
            applications.map((application) => {
              const canUpdate =
                application.status !== "accepted" &&
                application.status !== "rejected" &&
                application.status !== "withdrawn";
              const acceptAction = updateClientApplicationStatusAction.bind(
                null,
                project.id,
                application.id,
                "accepted",
              );
              const rejectAction = updateClientApplicationStatusAction.bind(
                null,
                project.id,
                application.id,
                "rejected",
              );

              return (
                <article
                  key={application.id}
                  className="rounded-[1.75rem] border border-line bg-white p-5"
                >
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-3">
                        <h3 className="text-xl font-semibold text-black">
                          {application.provider?.full_name ?? "Provider"}
                        </h3>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-sm font-semibold ${applicationStatusClasses(
                            application.status,
                          )}`}
                        >
                          {applicationStatusLabel(application.status)}
                        </span>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-secondary">
                        {application.provider?.email ? (
                          <p>{application.provider.email}</p>
                        ) : null}
                        {application.provider?.phone ? (
                          <p>{application.provider.phone}</p>
                        ) : null}
                        {application.provider?.city || application.provider?.country ? (
                          <p>
                            {[application.provider.city, application.provider.country]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        ) : null}
                      </div>
                    </div>

                    {canUpdate ? (
                      <div className="flex flex-wrap gap-3">
                        <form action={acceptAction}>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-2xl bg-black px-4 py-2 text-sm font-semibold text-white transition hover:bg-black/85"
                          >
                            Accept
                          </button>
                        </form>
                        <form action={rejectAction}>
                          <button
                            type="submit"
                            className="inline-flex items-center justify-center rounded-2xl border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                          >
                            Reject
                          </button>
                        </form>
                      </div>
                    ) : null}
                  </div>

                  <div className="mt-5 grid gap-4 text-sm text-secondary md:grid-cols-3">
                    <p>
                      <span className="font-semibold text-black">Price:</span>{" "}
                      {formatPrice(application.proposed_price)}
                    </p>
                    <p>
                      <span className="font-semibold text-black">Delivery:</span>{" "}
                      {application.estimated_delivery_days != null
                        ? `${application.estimated_delivery_days} days`
                        : "Flexible"}
                    </p>
                    <p>
                      <span className="font-semibold text-black">Submitted:</span>{" "}
                      {formatDateLabel(application.created_at)}
                    </p>
                  </div>

                  <div className="mt-5 rounded-2xl border border-line bg-panel-soft p-4">
                    <p className="text-sm font-semibold text-black">Proposal</p>
                    <p className="mt-2 whitespace-pre-line break-words text-sm leading-6 text-secondary">
                      {application.cover_message}
                    </p>
                  </div>
                </article>
              );
            })
          ) : (
            <div className="rounded-[1.75rem] border border-dashed border-line-strong bg-panel-soft p-8 text-center">
              <h3 className="text-xl font-semibold text-black">
                No applications yet
              </h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-secondary">
                Provider proposals will appear here once this published brief starts
                receiving applications.
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(320px,0.9fr)]">
        <div className="space-y-6">
          <article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
            <h2 className="text-2xl font-semibold text-black">What needs to be done</h2>
            <p className="mt-4 text-sm leading-7 text-secondary sm:text-base">
              {project.what_do_you_need_text || "No implementation details added."}
            </p>
          </article>

          <article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
            <h2 className="text-2xl font-semibold text-black">Business context</h2>
            <div className="mt-4 space-y-4 text-sm leading-7 text-secondary sm:text-base">
              <p>
                {project.business_context_text || "No additional business context added."}
              </p>
              {project.business_domain_other_text ? (
                <p>
                  <span className="font-semibold text-black">Custom domain:</span>{" "}
                  {project.business_domain_other_text}
                </p>
              ) : null}
              {project.existing_website_url ? (
                <p>
                  <span className="font-semibold text-black">Existing website:</span>{" "}
                  <a
                    href={project.existing_website_url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-semibold text-black underline"
                  >
                    {project.existing_website_url}
                  </a>
                </p>
              ) : null}
            </div>
          </article>
        </div>

        <div className="space-y-6">
          <article className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
            <h2 className="text-2xl font-semibold text-black">Project setup</h2>
            <div className="mt-5 grid gap-3 text-sm text-secondary">
              <p>
                <span className="font-semibold text-black">Needs design:</span>{" "}
                {project.needs_design ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold text-black">Needs SEO:</span>{" "}
                {project.needs_seo ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold text-black">Remote friendly:</span>{" "}
                {project.is_remote_friendly ? "Yes" : "No"}
              </p>
              <p>
                <span className="font-semibold text-black">Preferred provider:</span>{" "}
                {project.preferred_provider_type}
              </p>
              <p>
                <span className="font-semibold text-black">Preferred language:</span>{" "}
                {project.preferred_language || "Not specified"}
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
    </section>
  );
}
