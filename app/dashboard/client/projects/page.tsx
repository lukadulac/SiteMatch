import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { DashboardListPagination, DashboardStatusFilters, DASHBOARD_LIST_PAGE_SIZE, dashboardListHref, parseDashboardPage, parseDashboardStatus } from "@/components/dashboard/DashboardListControls";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUnreadConversationCount } from "@/lib/messaging/service";
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

function formatBudgetLabel(
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
    return `Fixed: ${formatter.format(budgetMin ?? budgetMax ?? 0)}`;
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

export default async function ClientProjectsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams;
  const status = parseDashboardStatus(params.status, ["all", "draft", "published", "in_discussion", "assigned", "completed", "cancelled"] as const);
  const page = parseDashboardPage(params.page);
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

  const [projectsCountResult, unreadCountResult] = await Promise.all([
    (() => {
      let query = supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", user.id);
      if (status !== "all") query = query.eq("status", status);
      return query;
    })(),
    getUnreadConversationCount(supabase, user.id),
  ]);

  if (projectsCountResult.error) throw new Error(projectsCountResult.error.message);
  if (unreadCountResult.error) throw new Error(unreadCountResult.error);
  const totalCount = projectsCountResult.count ?? 0;
  const totalPages = Math.ceil(totalCount / DASHBOARD_LIST_PAGE_SIZE);
  if (page > Math.max(1, totalPages)) redirect(dashboardListHref("/dashboard/client/projects", status, Math.max(1, totalPages)));

  let projectsQuery = supabase.from("projects")
    .select("id, slug, title, status, description, service_type_id, budget_type, budget_min, budget_max, deadline_type, deadline_date, desired_start_date, updated_at, created_at")
    .eq("client_id", user.id);
  if (status !== "all") projectsQuery = projectsQuery.eq("status", status);
  const projectsResult = await projectsQuery.order("updated_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * DASHBOARD_LIST_PAGE_SIZE, page * DASHBOARD_LIST_PAGE_SIZE - 1);
  if (projectsResult.error) throw new Error(projectsResult.error.message);
  const projects = projectsResult.data ?? [];
  const unreadConversationCount = unreadCountResult.data ?? 0;

  return (
    <DashboardShell
      title="Projects"
      subtitle="Manage drafts, published briefs, assigned work, and completed projects from one focused screen."
      actionHref="/oglasi/novi"
      actionLabel="Post a Project"
      navItems={[
        { href: "/dashboard/client", label: "Overview" },
        {
          href: "/dashboard/client/projects",
          label: "Projects",
          count: totalCount,
          active: true,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversationCount,
        },
        { href: "/dashboard/client/profile", label: "Profile" },
      ]}
    >
      <DashboardPanel title="All Projects">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-secondary">{totalCount} project{totalCount === 1 ? "" : "s"}</p>
          <DashboardStatusFilters basePath="/dashboard/client/projects" status={status} options={[{ value: "all", label: "All" }, { value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "in_discussion", label: "In discussion" }, { value: "assigned", label: "Assigned" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }]} />
        </div>
        <div className="space-y-4">
          {projects.length > 0 ? (
            projects.map((project) => (
              <article
                key={project.id}
                className="rounded-3xl border border-line bg-white p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h3 className="wrap-break-word text-base font-semibold text-black">
                      {project.title}
                    </h3>
                    <p className="mt-2 line-clamp-3 wrap-break-word text-sm leading-6 text-secondary">
                      {project.description}
                    </p>
                  </div>
                  <span
                    className={`inline-flex shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${statusClasses(
                      project.status,
                    )}`}
                  >
                    {statusLabel(project.status)}
                  </span>
                </div>

                <div className="mt-5 grid gap-4 text-sm text-secondary md:grid-cols-2 xl:grid-cols-4">
                  <p>Budget: {formatBudgetLabel(project.budget_type, project.budget_min, project.budget_max)}</p>
                  <p>Deadline: {formatDateLabel(project.deadline_date)}</p>
                  <p>Start: {formatDateLabel(project.desired_start_date)}</p>
                  <p>Created: {formatDateLabel(project.created_at)}</p>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <Link
                    href={`/oglasi/${project.id}`}
                    className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                  >
                    View Details
                  </Link>
                  {project.status === "draft" || project.status === "published" ? (
                    <Link
                      href={`/oglasi/${project.id}/edit`}
                      className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                    >
                      {project.status === "draft" ? "Continue editing" : "Edit listing"}
                    </Link>
                  ) : null}
                </div>
              </article>
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-line p-8 text-sm text-secondary">
              {status === "all" ? "You do not have projects yet. Create your first listing to start receiving provider interest." : "No projects match this status."}
            </div>
          )}
        </div>
        <DashboardListPagination basePath="/dashboard/client/projects" status={status} page={page} totalPages={totalPages} />
      </DashboardPanel>
    </DashboardShell>
  );
}
