import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { getClientProjects } from "@/lib/projects/service";
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

export default async function ClientProjectsPage() {
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

  const [profileResult, projectsResult, conversationsResult] = await Promise.all([
    supabase.from("profiles").select("full_name").eq("id", user.id).single(),
    getClientProjects(supabase, user.id),
    getUserConversations(supabase, user.id),
  ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message ?? "Profile could not be loaded.");
  }

  if (projectsResult.error) {
    throw new Error(projectsResult.error);
  }

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  const projects = projectsResult.data ?? [];
  const unreadConversations = (conversationsResult.data ?? []).filter(
    (conversation) => conversation.unread_count > 0,
  );

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
          count: projects.length,
          active: true,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/client/profile", label: "Profile" },
      ]}
    >
      <DashboardPanel title="All Projects">
        <div className="space-y-4">
          {projects.length > 0 ? (
            projects.map((project) => (
              <article
                key={project.id}
                className="rounded-3xl border border-line bg-white p-5"
              >
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div className="min-w-0">
                    <h2 className="wrap-break-word text-xl font-semibold text-black">
                      {project.title}
                    </h2>
                    <p className="mt-2 line-clamp-3 wrap-break-word3 text-sm leading-6 text-secondary">
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
              You do not have projects yet. Create your first listing to start
              receiving provider interest.
            </div>
          )}
        </div>
      </DashboardPanel>
    </DashboardShell>
  );
}
