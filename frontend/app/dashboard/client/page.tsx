import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  conversationPartner,
  MessagesPanel,
  WorkroomsPanel,
} from "@/components/dashboard/overview/overview-panels";
import {
  type ChipTone,
  joinNames,
  type NeedsItem,
  NeedsYouCard,
  OverviewHeader,
  OverviewPanel,
  OverviewRow,
  OverviewRows,
  PanelEmpty,
  StatLinks,
  StatusChip,
} from "@/components/dashboard/overview/overview-ui";
import { ServiceRequestNotice } from "@/components/service-requests/service-request-ui";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import { getUnreadConversationCount, getUserConversations } from "@/lib/messaging/service";
import { getClientServiceRequestPreview } from "@/lib/provider-service-requests/service";
import { getClientProjects } from "@/lib/projects/service";
import { getClientWorkroomPreview } from "@/lib/service-workrooms/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const projectStatus: Record<string, { label: string; tone: ChipTone }> = {
  published: { label: "Open", tone: "green" },
  in_discussion: { label: "In discussion", tone: "amber" },
  assigned: { label: "Assigned", tone: "blue" },
};

const requestStatus: Record<string, { label: string; tone: ChipTone }> = {
  pending: { label: "Pending", tone: "neutral" },
  accepted: { label: "Accepted", tone: "green" },
  rejected: { label: "Declined", tone: "red" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

const moneyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function formatBudgetLabel(
  budgetType: string,
  budgetMin: number | null,
  budgetMax: number | null,
) {
  if (budgetType === "negotiable") {
    return "Negotiable";
  }

  if (budgetType === "fixed") {
    const amount = budgetMin ?? budgetMax;
    return amount != null ? `${moneyFormatter.format(amount)} fixed` : "Fixed price";
  }

  if (budgetMin != null && budgetMax != null) {
    return `${moneyFormatter.format(budgetMin)} – ${moneyFormatter.format(budgetMax)}`;
  }

  if (budgetMin != null) {
    return `From ${moneyFormatter.format(budgetMin)}`;
  }

  if (budgetMax != null) {
    return `Up to ${moneyFormatter.format(budgetMax)}`;
  }

  return "Budget not set";
}

export default async function ClientDashboardPage({
  searchParams,
}: {
  searchParams?: Promise<{
    serviceError?: string | string[];
    serviceStatus?: string | string[];
  }>;
}) {
  const params = await searchParams;
  const serviceError =
    typeof params?.serviceError === "string" ? params.serviceError : null;
  const serviceStatus =
    typeof params?.serviceStatus === "string" ? params.serviceStatus : null;
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

  const [
    profileResult,
    clientProfileResult,
    projectsResult,
    conversationsResult,
    serviceRequestsResult,
    workroomsResult,
    projectCountResult,
    activeProjectCountResult,
    draftProjectCountResult,
    reviewApplicationCountResult,
    pendingRequestCountResult,
    unreadConversationCountResult,
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url, country, city")
        .eq("id", user.id)
        .single(),
      supabase
        .from("client_profiles")
        .select(
          "business_name, business_tax_id, business_type, business_type_text, project_idea, website_url, company_size, interested_solution_types, interested_solution_other_text",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getClientProjects(supabase, user.id, {
        limit: 5,
        statuses: ["published", "in_discussion", "assigned"],
      }),
      getUserConversations(supabase, user.id, { limit: 3 }),
      getClientServiceRequestPreview(supabase, user.id),
      getClientWorkroomPreview(supabase, user.id),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", user.id),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", user.id).in("status", ["published", "in_discussion", "assigned"]),
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "draft"),
      supabase.from("applications").select("id, project:projects!inner(client_id)", { count: "exact", head: true }).eq("project.client_id", user.id).in("status", ["pending", "viewed", "shortlisted"]),
      supabase.from("provider_service_requests").select("id", { count: "exact", head: true }).eq("client_id", user.id).eq("status", "pending"),
      getUnreadConversationCount(supabase, user.id),
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

  if (serviceRequestsResult.error) {
    throw new Error(serviceRequestsResult.error);
  }

  if (workroomsResult.error) {
    throw new Error(workroomsResult.error);
  }

  for (const result of [projectCountResult, activeProjectCountResult, draftProjectCountResult, reviewApplicationCountResult, pendingRequestCountResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  if (unreadConversationCountResult.error) {
    throw new Error(unreadConversationCountResult.error);
  }

  const profile = profileResult.data;
  const clientProfile = clientProfileResult.data;
  const projects = projectsResult.data ?? [];
  const conversations = conversationsResult.data ?? [];
  const serviceRequests = serviceRequestsResult.data ?? [];
  const workrooms = workroomsResult.data ?? [];
  const reviewApplicationCount = reviewApplicationCountResult.count ?? 0;
  const unreadConversationCount = unreadConversationCountResult.data ?? 0;
  const projectIds = projects.map((project) => project.id);
  const applicationsResult =
    projectIds.length > 0
      ? await supabase
          .from("applications")
          .select("id, project_id")
          .in("project_id", projectIds)
      : { data: [], error: null };

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }

  const applications = applicationsResult.data ?? [];
  const isComplete = isClientProfileComplete(clientProfile);

  const unreadNames = conversations
    .filter((conversation) => conversation.unread_count > 0)
    .map((conversation) => conversationPartner(conversation, user.id)?.full_name)
    .filter((name): name is string => Boolean(name));
  const needs: NeedsItem[] = [
    ...(reviewApplicationCount > 0
      ? [{
          id: "proposals",
          title: `${reviewApplicationCount} proposal${reviewApplicationCount === 1 ? "" : "s"} to review`,
          detail: "New proposals on your active projects",
          actionLabel: "Review proposals",
          href: "/dashboard/client/projects",
          icon: "proposals" as const,
        }]
      : []),
    ...(unreadConversationCount > 0
      ? [{
          id: "unread",
          title: `${unreadConversationCount} unread conversation${unreadConversationCount === 1 ? "" : "s"}`,
          detail: unreadNames.length > 0 ? joinNames(unreadNames) : "Providers waiting for your reply",
          actionLabel: "Reply",
          href: "/dashboard/messages",
          icon: "message" as const,
        }]
      : []),
    ...(!isComplete
      ? [{
          id: "profile",
          title: "Finish your profile",
          detail: "Providers reply faster when they can see who they're working with.",
          actionLabel: "Complete profile",
          href: "/dashboard/client/profile",
          icon: "profile" as const,
        }]
      : []),
  ];

  return (
    <DashboardShell
      navItems={[
        { href: "/dashboard/client", label: "Overview", active: true },
        {
          href: "/dashboard/client/projects",
          label: "Projects",
          count: projectCountResult.count ?? 0,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversationCount,
        },
      ]}
    >
      <div className="space-y-4 sm:space-y-6">
        <OverviewHeader
          name={profile.full_name}
          avatarPath={profile.avatar_url}
          action={{ href: "/oglasi/novi", label: "Post a project", icon: "plus" }}
        />

        {serviceStatus || serviceError ? (
          <div className="space-y-3">
            <ServiceRequestNotice status={serviceStatus} error={serviceError} />
          </div>
        ) : null}

        <NeedsYouCard
          items={needs}
          caughtUpText="New proposals, requests and messages will show up here."
        />

        <StatLinks
          stats={[
            { label: "Active projects", value: activeProjectCountResult.count ?? 0, href: "/dashboard/client/projects" },
            { label: "Drafts", value: draftProjectCountResult.count ?? 0, href: "/dashboard/client/projects?status=draft" },
            { label: "Requests awaiting reply", value: pendingRequestCountResult.count ?? 0, href: "/dashboard/client/service-requests?status=pending" },
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-1 lg:gap-6">
            <OverviewPanel
              id="projects-heading"
              title="Active projects"
              viewAllHref={projects.length > 0 ? "/dashboard/client/projects" : undefined}
            >
              {projects.length > 0 ? (
                <OverviewRows>
                  {projects.map((project) => {
                    const proposalCount = applications.filter(
                      (application) => application.project_id === project.id,
                    ).length;
                    const status = projectStatus[project.status] ?? projectStatus.published;

                    return (
                      <OverviewRow
                        key={project.id}
                        href={`/oglasi/${project.id}`}
                        title={project.title}
                        detail={`${formatBudgetLabel(project.budget_type, project.budget_min, project.budget_max)} · ${proposalCount} proposal${proposalCount === 1 ? "" : "s"}`}
                        chip={<StatusChip label={status.label} tone={status.tone} />}
                      />
                    );
                  })}
                </OverviewRows>
              ) : (
                <PanelEmpty
                  text="No active projects. Post a brief and providers from every trade can send you proposals."
                  link={{ href: "/oglasi/novi", label: "Post a project" }}
                />
              )}
            </OverviewPanel>

            <OverviewPanel
              id="requests-heading"
              title="Service requests sent"
              viewAllHref={serviceRequests.length > 0 ? "/dashboard/client/service-requests" : undefined}
            >
              {serviceRequests.length > 0 ? (
                <OverviewRows>
                  {serviceRequests.map((request) => {
                    const status = requestStatus[request.status] ?? requestStatus.pending;
                    const providerName = request.provider?.full_name ?? "Provider";

                    return (
                      <OverviewRow
                        key={request.id}
                        href={`/dashboard/service-requests/${request.id}`}
                        person={{ name: providerName, avatarPath: request.provider?.avatar_url ?? null }}
                        title={request.service?.title ?? "Service request"}
                        detail={providerName}
                        chip={<StatusChip label={status.label} tone={status.tone} />}
                      />
                    );
                  })}
                </OverviewRows>
              ) : (
                <PanelEmpty
                  text="No service requests yet. Find a provider and request one of their services."
                  link={{ href: "/find-talent", label: "Find talent" }}
                />
              )}
            </OverviewPanel>
          </div>

          <aside aria-label="Workrooms and messages" className="flex min-w-0 flex-col gap-4 lg:w-80 lg:shrink-0 lg:gap-6">
            <WorkroomsPanel workrooms={workrooms} role="client" />
            <MessagesPanel conversations={conversations} userId={user.id} role="client" />
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
