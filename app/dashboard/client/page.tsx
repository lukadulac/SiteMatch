import Link from "next/link";
import { redirect } from "next/navigation";
import {
  DashboardPanel,
  DashboardShell,
  DashboardStatCard,
} from "@/components/dashboard/DashboardShell";
import { ClientProfileForm } from "@/components/dashboard/client-profile-form";
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

  const activeProjects = projects.filter((project) =>
    ["published", "in_discussion", "assigned"].includes(project.status),
  );
  const completedProjects = projects.filter(
    (project) => project.status === "completed",
  );
  const draftProjects = projects.filter((project) => project.status === "draft");
  const unreadConversations = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  );
  const isComplete = isClientProfileComplete(clientProfile);

  return (
    <DashboardShell
      title={`Welcome back, ${profile.full_name.split(" ")[0] || "Client"}!`}
      subtitle="Here is an overview of your hiring activity and business profile progress."
      actionHref="/oglasi/novi"
      actionLabel="Post a Project"
      navItems={[
        { href: "/dashboard/client", label: "Overview", active: true },
        {
          href: "/dashboard/client#projects",
          label: "Active Projects",
          count: activeProjects.length,
        },
        {
          href: "/dashboard/client#messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/client#profile", label: "Profile" },
      ]}
    >
      <div className="grid gap-5 xl:grid-cols-4">
        <DashboardStatCard
          value={String(activeProjects.length)}
          label="Active Projects"
          detail={`${draftProjects.length} draft${draftProjects.length === 1 ? "" : "s"} still in progress`}
        />
        <DashboardStatCard
          value={String(projects.length)}
          label="Total Projects"
          detail={`${completedProjects.length} completed so far`}
        />
        <DashboardStatCard
          value={String(conversations.length)}
          label="Conversations"
          detail={`${unreadConversations.length} with unread updates`}
        />
        <DashboardStatCard
          value={isComplete ? "100%" : "In progress"}
          label="Profile Status"
          detail={
            isComplete
              ? "Client profile is complete"
              : "Finish profile to unlock the full client flow"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
        <DashboardPanel
          title="Active Projects"
          action={
            <Link
              href="/oglasi"
              className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
            >
              View All
            </Link>
          }
        >
          <div id="projects" className="space-y-4">
            {activeProjects.length > 0 ? (
              activeProjects.slice(0, 3).map((project) => (
                <article
                  key={project.id}
                  className="rounded-[1.5rem] border border-line p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-black">
                        {project.title}
                      </h3>
                      <p className="mt-2 max-w-2xl text-sm leading-6 text-secondary">
                        {project.description}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${statusClasses(
                        project.status,
                      )}`}
                    >
                      {statusLabel(project.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 text-sm text-secondary md:grid-cols-3">
                    <p>Created: {formatDateLabel(project.created_at)}</p>
                    <p>Updated: {formatDateLabel(project.updated_at)}</p>
                    <p>Deadline: {formatDateLabel(project.deadline_date)}</p>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/oglasi/${project.slug}`}
                      className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                    >
                      View Details
                    </Link>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-line p-8 text-sm text-secondary">
                You do not have active projects yet. Create your first listing to
                start receiving provider interest.
              </div>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Messages">
          <div id="messages" className="space-y-4">
            {conversations.length > 0 ? (
              <>
                {conversations.slice(0, 4).map((conversation) => {
                  const otherParty =
                    conversation.provider_id === user.id
                      ? conversation.client
                      : conversation.provider;

                  return (
                    <article
                      key={conversation.id}
                      className="rounded-[1.5rem] border border-line p-4"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <p className="font-semibold text-black">
                            {otherParty?.full_name ?? "Marketplace conversation"}
                          </p>
                          <p className="mt-1 text-sm text-secondary">
                            {conversation.project?.title ?? "Untitled project"}
                          </p>
                          <p className="mt-3 text-sm leading-6 text-secondary">
                            {conversation.last_message?.message_text ??
                              "No messages yet."}
                          </p>
                          <p className="mt-3 text-xs font-medium uppercase tracking-[0.14em] text-secondary">
                            {formatTimeAgo(
                              conversation.last_message?.created_at ??
                                conversation.updated_at,
                            )}
                          </p>
                        </div>
                        {conversation.unread_count > 0 ? (
                          <span className="inline-flex min-w-8 items-center justify-center rounded-full bg-linear-to-r from-violet-500 to-pink-500 px-2 py-1 text-xs font-semibold text-white">
                            {conversation.unread_count}
                          </span>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
                <Link
                  href="/dashboard/client#messages"
                  className="block rounded-2xl border border-line px-4 py-3 text-center text-sm font-semibold text-black transition hover:bg-black/3"
                >
                  View All
                </Link>
              </>
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-line p-8 text-sm text-secondary">
                No conversations yet. Once you connect with providers, messages
                will appear here.
              </div>
            )}
          </div>
        </DashboardPanel>
      </div>

      <div
        id="profile"
        className={`rounded-[2rem] border p-5 sm:p-6 ${
          isComplete
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-black">
          Profile progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-black">
          {isComplete ? "Your client profile is complete" : "Finish your client profile"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
          {isComplete
            ? "Your profile is ready and you can continue posting projects and managing incoming conversations."
            : "Complete the remaining client fields below so your business profile is ready for project creation and better provider matching."}
        </p>
      </div>

      <DashboardPanel title="Client Profile">
        <ClientProfileForm profile={profile} clientProfile={clientProfile} />
      </DashboardPanel>
    </DashboardShell>
  );
}
