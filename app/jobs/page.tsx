import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getPublishedProjectsForProviders } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

export default async function ProviderOpportunitiesPage() {
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

  const projectsResult = await getPublishedProjectsForProviders(supabase, user.id);

  if (projectsResult.error) {
    throw new Error(projectsResult.error);
  }

  const projects = projectsResult.data ?? [];

  return (
    <section className="space-y-8 py-4 sm:py-8">
      <div className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary">
              Provider opportunities
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-black sm:text-4xl">
              Find project briefs ready for proposals
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
              Review published client briefs, qualify fit quickly, and choose the
              projects worth turning into applications.
            </p>
          </div>

          <Link
            href="/dashboard/provider"
            className="inline-flex items-center justify-center rounded-2xl border border-line-strong bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-black/3"
          >
            Provider dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            value: String(projects.length),
            label: "Open briefs",
            detail: "Published projects currently accepting provider interest",
          },
          {
            value: String(
              projects.filter((project) => project.deadline_type === "asap").length,
            ),
            label: "ASAP timelines",
            detail: "Clients asking for a fast start",
          },
          {
            value: String(
              projects.filter((project) => project.budget_type === "negotiable").length,
            ),
            label: "Negotiable budgets",
            detail: "Briefs where pricing can be shaped in the proposal",
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)]"
          >
            <p className="text-4xl font-semibold text-black">{item.value}</p>
            <p className="mt-3 text-base font-semibold text-black">{item.label}</p>
            <p className="mt-1 text-sm text-secondary">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5">
        {projects.length > 0 ? (
          projects.map((project) => (
            <article
              key={project.id}
              className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="inline-flex rounded-full bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-700">
                      Published
                    </span>
                    <span className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
                      {providerTypeLabel(project.preferred_provider_type)}
                    </span>
                  </div>
                  <h2 className="mt-4 text-2xl font-semibold text-black">
                    {project.title}
                  </h2>
                  <p className="mt-3 line-clamp-3 wrap-break-words text-sm leading-6 text-secondary sm:text-base">
                    {project.description}
                  </p>
                </div>

                <Link
                  href={`/jobs/${project.id}`}
                  className="inline-flex shrink-0 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
                >
                  View brief
                </Link>
              </div>

              <div className="mt-6 grid gap-4 text-sm text-secondary md:grid-cols-2 xl:grid-cols-4">
                <p>Budget: {formatBudget(project.budget_type, project.budget_min, project.budget_max)}</p>
                <p>Deadline: {formatDateLabel(project.deadline_date)}</p>
                <p>Scope: {scopeLabel(project.scope_level)}</p>
                <p>Readiness: {readinessLabel(project.readiness_level)}</p>
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-4xl border border-dashed border-line-strong bg-white/80 p-10 text-center shadow-[0_16px_40px_rgba(17,17,17,0.03)]">
            <h2 className="text-2xl font-semibold text-black">
              No published briefs yet
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
              Published client projects will appear here once clients start opening
              briefs to provider proposals.
            </p>
            <Link
              href="/dashboard/provider"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/85"
            >
              Back to dashboard
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
