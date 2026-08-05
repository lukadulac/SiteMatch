import Link from "next/link";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath, type UserRole } from "@/lib/auth/roles";
import { getPublicPublishedProjects } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { headerTheme } from "@/theme/header-theme";

type JobsPageProps = {
  searchParams: Promise<{
    q?: string;
    budget?: string;
    scope?: string;
    sort?: string;
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

function budgetTypeLabel(value: string) {
  switch (value) {
    case "fixed":
      return "Fixed Price";
    case "range":
      return "Budget Range";
    case "negotiable":
      return "Negotiable";
    default:
      return "Budget";
  }
}

function formatPostedLabel(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `Posted ${diffHours}h ago`;
  }

  const diffDays = Math.floor(diffHours / 24);

  return `Posted ${diffDays}d ago`;
}

function getSearchParam(value: string | string[] | undefined) {
  return typeof value === "string" ? value : "";
}

function getTagLabels(project: {
  budget_type: string;
  preferred_provider_type: string | null;
  scope_level: string | null;
  readiness_level: string | null;
  needs_design: boolean;
  needs_seo: boolean;
  needs_content_writing: boolean;
}) {
  return [
    budgetTypeLabel(project.budget_type),
    providerTypeLabel(project.preferred_provider_type),
    scopeLabel(project.scope_level),
    readinessLabel(project.readiness_level),
    project.needs_design ? "Design" : null,
    project.needs_seo ? "SEO" : null,
    project.needs_content_writing ? "Content" : null,
  ].filter((tag): tag is string => Boolean(tag));
}

function getProjectExcerpt(description: string) {
  const trimmedDescription = description.trim().replace(/\s+/g, " ");

  if (trimmedDescription.length <= 150) {
    return trimmedDescription;
  }

  return `${trimmedDescription.slice(0, 150).trimEnd()}...`;
}

export default async function ProviderOpportunitiesPage({
  searchParams,
}: JobsPageProps) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const query = await searchParams;
  const q = getSearchParam(query.q);
  const budget = getSearchParam(query.budget);
  const scope = getSearchParam(query.scope);
  const sort = getSearchParam(query.sort) || "newest";

  let role: UserRole | null = null;

  if (user) {
    const provisioned = await ensureUserProfile(supabase, user);
    role = provisioned.role ?? null;
  }

  const projectsResult = await getPublicPublishedProjects(supabase, {
    q,
    budget:
      budget === "fixed" || budget === "range" || budget === "negotiable"
        ? budget
        : "",
    scope:
      scope === "small" || scope === "medium" || scope === "large" ? scope : "",
    sort:
      sort === "oldest" || sort === "budget_high" || sort === "budget_low"
        ? sort
        : "newest",
  });

  if (projectsResult.error) {
    throw new Error(projectsResult.error);
  }

  const projects = projectsResult.data ?? [];
  const dashboardHref = role ? getDashboardPath(role) : null;
  const primaryActionHref = role === "provider" ? "/dashboard/provider" : "/login";
  const primaryActionLabel =
    role === "provider"
      ? "Provider dashboard"
      : role
        ? "Go to dashboard"
        : "Sign in to apply";
  const activeFilters = [
    q ? `Search: ${q}` : null,
    budget ? budgetTypeLabel(budget) : null,
    scope ? scopeLabel(scope) : null,
  ].filter((filter): filter is string => Boolean(filter));

  return (
    <section className="space-y-7 py-4 sm:py-8">
      <div className="space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.18em] text-secondary">
              WorkBridge opportunities
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-black sm:text-4xl">
              Find project briefs ready for proposals
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
              Browse real client briefs as a guest. Sign in as a provider when you
              are ready to submit a proposal.
            </p>
          </div>

          <Link
            href={
              role && role !== "provider" && dashboardHref
                ? dashboardHref
                : primaryActionHref
            }
            className="inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
            style={{
              background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
            }}
          >
            {role && role !== "provider" ? "Dashboard" : primaryActionLabel}
          </Link>
        </div>

        <form
          action="/jobs"
          className="rounded-[1.75rem] border border-line bg-white/90 p-4 shadow-[0_16px_45px_rgba(17,17,17,0.05)]"
        >
          <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_180px_160px_170px_auto]">
            <label className="sr-only" htmlFor="jobs-search">
              Search open projects
            </label>
            <input
              id="jobs-search"
              name="q"
              type="search"
              defaultValue={q}
              placeholder="Search open projects, skills, or requirements..."
              className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm text-black outline-none transition placeholder:text-secondary/70 focus:border-black"
            />

            <label className="sr-only" htmlFor="budget-filter">
              Budget
            </label>
            <select
              id="budget-filter"
              name="budget"
              defaultValue={budget}
              className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold text-black outline-none transition focus:border-black"
            >
              <option value="">Any budget</option>
              <option value="fixed">Fixed price</option>
              <option value="range">Budget range</option>
              <option value="negotiable">Negotiable</option>
            </select>

            <label className="sr-only" htmlFor="scope-filter">
              Scope
            </label>
            <select
              id="scope-filter"
              name="scope"
              defaultValue={scope}
              className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold text-black outline-none transition focus:border-black"
            >
              <option value="">Any scope</option>
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
            </select>

            <label className="sr-only" htmlFor="sort-filter">
              Sort
            </label>
            <select
              id="sort-filter"
              name="sort"
              defaultValue={sort}
              className="min-h-11 rounded-2xl border border-line-strong bg-white px-4 text-sm font-semibold text-black outline-none transition focus:border-black"
            >
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="budget_high">Budget high</option>
              <option value="budget_low">Budget low</option>
            </select>

            <button
              type="submit"
              className="min-h-11 rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
              style={{
                background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
              }}
            >
              Filter
            </button>
          </div>

          {activeFilters.length > 0 ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-secondary">
                Active
              </span>
              {activeFilters.map((filter) => (
                <span
                  key={filter}
                  className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-black"
                >
                  {filter}
                </span>
              ))}
              <Link
                href="/jobs"
                className="rounded-full border border-line-strong px-3 py-1 text-xs font-semibold text-black transition hover:bg-black/3"
              >
                Clear all
              </Link>
            </div>
          ) : null}
        </form>
      </div>

      <div className="flex flex-col gap-3 border-b border-line pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold text-black">Open Project Briefs</h2>
          <p className="mt-1 text-sm text-secondary">
            {projects.length} result{projects.length === 1 ? "" : "s"} available
          </p>
        </div>
        <p className="text-sm font-semibold text-secondary">
          Sorted by{" "}
          <span className="text-black">
            {sort === "oldest"
              ? "oldest"
              : sort === "budget_high"
                ? "highest budget"
                : sort === "budget_low"
                  ? "lowest budget"
                  : "newest"}
          </span>
        </p>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-2">
        {projects.length > 0 ? (
          projects.map((project) => {
            const tags = getTagLabels(project).slice(0, 5);

            return (
              <article
                key={project.id}
                className="flex min-w-0 flex-col rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)] sm:p-6"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    New
                  </span>
                  <span className="min-w-0 wrap-break-word text-xs font-medium text-secondary">
                    {budgetTypeLabel(project.budget_type)} ·{" "}
                    {formatPostedLabel(project.created_at)}
                  </span>
                </div>

                <h3 className="mt-4 line-clamp-2 wrap-break-word text-xl font-semibold leading-7 text-black">
                  {project.title}
                </h3>

                <p className="mt-5 line-clamp-3 break-all text-lg leading-7 text-black sm:wrap-break-word sm:text-xl sm:leading-8">
                  {getProjectExcerpt(project.description)}
                </p>

                <div className="mt-6 grid gap-3 text-sm text-secondary sm:grid-cols-2">
                  <p>
                    <span className="font-semibold text-black">Budget:</span>{" "}
                    {formatBudget(
                      project.budget_type,
                      project.budget_min,
                      project.budget_max,
                    )}
                  </p>
                  <p>
                    <span className="font-semibold text-black">Deadline:</span>{" "}
                    {formatDateLabel(project.deadline_date)}
                  </p>
                  <p>
                    <span className="font-semibold text-black">Scope:</span>{" "}
                    {scopeLabel(project.scope_level)}
                  </p>
                  <p>
                    <span className="font-semibold text-black">Readiness:</span>{" "}
                    {readinessLabel(project.readiness_level)}
                  </p>
                </div>

                <div className="mt-5 flex min-w-0 flex-wrap gap-2">
                  {tags.map((tag) => (
                    <span
                      key={tag}
                      className="max-w-full truncate rounded-full bg-zinc-100 px-3 py-1 text-xs font-semibold text-secondary"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                <div className="mt-auto pt-6">
                  <Link
                    href={`/jobs/${project.id}`}
                    className="inline-flex min-h-11 items-center justify-center rounded-2xl px-5 text-sm font-semibold text-white transition hover:opacity-90"
                    style={{
                      background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
                    }}
                  >
                    {role === "provider" ? "View brief" : "View details"}
                  </Link>
                </div>
              </article>
            );
          })
        ) : (
          <div className="rounded-4xl border border-dashed border-line-strong bg-white/80 p-10 text-center shadow-[0_16px_40px_rgba(17,17,17,0.03)] lg:col-span-2">
            <h2 className="text-2xl font-semibold text-black">
              No matching briefs
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
              Try clearing filters or checking back when more clients publish
              project briefs.
            </p>
            <Link
              href="/jobs"
              className="mt-6 inline-flex items-center justify-center rounded-2xl px-5 py-3 text-sm font-semibold text-white transition hover:opacity-90"
              style={{
                background: `linear-gradient(to right, ${headerTheme.gradientFrom}, ${headerTheme.gradientTo})`,
              }}
            >
              Clear filters
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
