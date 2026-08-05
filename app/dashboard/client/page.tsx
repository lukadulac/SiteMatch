import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
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

function formatTimeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function statusLabel(status: string) {
  switch (status) {
    case "published":
      return "Hiring";
    case "in_discussion":
      return "In Discussion";
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
      return "bg-emerald-50 text-emerald-700";
    case "in_discussion":
      return "bg-amber-50 text-amber-700";
    case "assigned":
      return "bg-blue-50 text-blue-700";
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

function OverviewStat({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 rounded-[1.5rem] border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
      <p className="break-words text-3xl font-semibold text-black sm:text-4xl">
        {value}
      </p>
      <p className="mt-3 break-words text-sm font-semibold text-black">{label}</p>
      <p className="mt-1 break-words text-xs leading-5 text-secondary">{detail}</p>
    </article>
  );
}

export default async function ClientDashboardPage() {
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

  const [profileResult, clientProfileResult, projectsResult, conversationsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, country, city")
        .eq("id", user.id)
        .single(),
      supabase
        .from("client_profiles")
        .select(
          "business_name, business_tax_id, business_type, business_type_text, project_idea, website_url, company_size, interested_solution_types, interested_solution_other_text",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getClientProjects(supabase, user.id),
      getUserConversations(supabase, user.id),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message ?? "Profile could not be loaded.");
  }

  if (clientProfileResult.error) {
    throw new Error(clientProfileResult.error.message);
  }

  if (projectsResult.error) {
    throw new Error(projectsResult.error);
  }

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  const profile = profileResult.data;
  const clientProfile = clientProfileResult.data;
  const projects = projectsResult.data ?? [];
  const conversations = conversationsResult.data ?? [];
  const projectIds = projects.map((project) => project.id);
  const applicationsResult =
    projectIds.length > 0
      ? await supabase
          .from("applications")
          .select("id, project_id, status, created_at")
          .in("project_id", projectIds)
      : { data: [], error: null };

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }

  const applications = applicationsResult.data ?? [];
  const activeProjects = projects.filter((project) =>
    ["published", "in_discussion", "assigned"].includes(project.status),
  );
  const draftProjects = projects.filter((project) => project.status === "draft");
  const reviewApplications = applications.filter((application) =>
    ["pending", "viewed", "shortlisted"].includes(application.status),
  );
  const unreadConversations = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  );
  const isComplete = isClientProfileComplete(clientProfile);

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={`Welcome back, ${
        profile.full_name.split(" ")[0] || "Client"
      }. Here's what's happening today.`}
      actionHref="/oglasi/novi"
      actionLabel="Post a Project"
      navItems={[
        { href: "/dashboard/client", label: "Overview", active: true },
        {
          href: "/dashboard/client/projects",
          label: "Projects",
          count: projects.length,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/client/profile", label: "Profile" },
      ]}
    >
      {!isComplete ? (
        <section className="flex flex-col gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">
            Complete your profile to improve project matching.
          </p>
          <Link href="/dashboard/client/profile" className="font-semibold underline">
            Complete
          </Link>
        </section>
      ) : null}

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <OverviewStat
          label="Active Projects"
          value={String(activeProjects.length)}
          detail={`${draftProjects.length} draft${draftProjects.length === 1 ? "" : "s"} still in progress`}
        />
        <OverviewStat
          label="Applications to Review"
          value={String(reviewApplications.length)}
          detail="Pending, viewed, or shortlisted proposals"
        />
        <OverviewStat
          label="Unread Messages"
          value={String(unreadConversations.length)}
          detail="Conversations needing a reply"
        />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[1.75rem] border border-line bg-white shadow-[0_16px_45px_rgba(17,17,17,0.05)]">
          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="min-w-0 break-words text-xl font-semibold text-black">
              Active Projects
            </h2>
            <Link
              href="/dashboard/client/projects"
              className="shrink-0 text-sm font-semibold text-black transition hover:opacity-70"
            >
              View All
            </Link>
          </div>

          <div className="divide-y divide-line">
            {activeProjects.length > 0 ? (
              activeProjects.slice(0, 5).map((project) => {
                const applicationCount = applications.filter(
                  (application) => application.project_id === project.id,
                ).length;

                return (
                  <article
                    key={project.id}
                    className="flex min-w-0 flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="break-words text-base font-semibold text-black">
                          {project.title}
                        </h3>
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(
                            project.status,
                          )}`}
                        >
                          {statusLabel(project.status)}
                        </span>
                      </div>
                      <p className="mt-1 line-clamp-1 break-words text-sm text-secondary">
                        {formatBudgetLabel(
                          project.budget_type,
                          project.budget_min,
                          project.budget_max,
                        )}{" "}
                        · {formatDateLabel(project.deadline_date)}
                      </p>
                    </div>

                    <div className="flex min-w-0 items-center justify-between gap-4 md:shrink-0 md:justify-start">
                      <div className="text-right text-sm">
                        <p className="font-semibold text-black">
                          {applicationCount || "--"}
                        </p>
                        <p className="text-xs text-secondary">Applicants</p>
                      </div>
                      <Link
                        href={`/oglasi/${project.id}`}
                        className="shrink-0 rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                      >
                        Review
                      </Link>
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="p-8 text-sm leading-6 text-secondary">
                No active projects yet. Publish a brief to start receiving provider
                interest.
              </div>
            )}
          </div>
        </div>

        <aside className="min-w-0 space-y-5">
          <section className="min-w-0 rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)]">
            <div className="flex min-w-0 items-center justify-between gap-4">
              <h2 className="min-w-0 break-words text-xl font-semibold text-black">
                Recent Messages
              </h2>
              <Link
                href="/dashboard/messages"
                className="shrink-0 text-sm font-semibold text-black transition hover:opacity-70"
              >
                Open
              </Link>
            </div>
            <div className="mt-5 space-y-4">
              {conversations.length > 0 ? (
                conversations.slice(0, 3).map((conversation) => {
                  const otherParty =
                    conversation.provider_id === user.id
                      ? conversation.client
                      : conversation.provider;

                  return (
                    <Link
                      key={conversation.id}
                      href={`/dashboard/messages?conversation=${conversation.id}`}
                      className="block min-w-0 rounded-2xl border border-line p-4 transition hover:bg-black/3"
                    >
                      <div className="flex min-w-0 items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-black">
                            {otherParty?.full_name ?? "Marketplace conversation"}
                          </p>
                          <p className="mt-1 line-clamp-2 text-sm leading-5 text-secondary">
                            {conversation.last_message?.message_text ??
                              "No messages yet."}
                          </p>
                        </div>
                        <span className="shrink-0 text-xs text-secondary">
                          {formatTimeAgo(
                            conversation.last_message?.created_at ??
                              conversation.updated_at,
                          )}
                        </span>
                      </div>
                    </Link>
                  );
                })
              ) : (
                <p className="rounded-2xl border border-dashed border-line p-4 text-sm text-secondary">
                  No conversations yet.
                </p>
              )}
            </div>
          </section>

          <section
            className={`min-w-0 rounded-[1.75rem] border p-5 ${
              isComplete
                ? "border-green-200 bg-green-50"
                : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="text-sm font-semibold text-black">Profile Status</p>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {isComplete
                ? "Your client profile is complete."
                : "Finish your client profile before heavy testing."}
            </p>
            <Link
              href="/dashboard/client/profile"
              className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
            >
              Manage profile
            </Link>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
