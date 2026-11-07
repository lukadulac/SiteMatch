import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import {
  conversationPartner,
  MessagesPanel,
  WorkroomsPanel,
} from "@/components/dashboard/overview/overview-panels";
import {
  type ChipTone,
  formatShortDate,
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
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import {
  getUnreadConversationCount,
  getUserConversations,
} from "@/lib/messaging/service";
import { getApplicationStatusMeta } from "@/lib/projects/application-status";
import { getProviderPendingServiceRequestPreview } from "@/lib/provider-service-requests/service";
import { getProviderWorkroomPreview } from "@/lib/service-workrooms/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const applicationTones: Record<string, ChipTone> = {
  pending: "neutral",
  viewed: "blue",
  shortlisted: "violet",
  accepted: "green",
  rejected: "red",
  withdrawn: "neutral",
};

const serviceStatus: Record<string, { label: string; tone: ChipTone }> = {
  published: { label: "Published", tone: "green" },
  paused: { label: "Paused", tone: "amber" },
  draft: { label: "Draft", tone: "neutral" },
};

const priceFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

function isProviderProfileReady(profile: {
  provider_type: string;
  years_of_experience: number | null;
  portfolio_url: string | null;
  service_categories: string[];
  service_category_other_text: string | null;
}) {
  return (
    profile.provider_type.length > 0 &&
    profile.years_of_experience != null &&
    typeof profile.portfolio_url === "string" &&
    profile.portfolio_url.trim().length > 0 &&
    profile.service_categories.length > 0 &&
    (!profile.service_categories.includes("other") ||
      (profile.service_category_other_text ?? "").trim().length > 0)
  );
}

export default async function ProviderDashboardPage() {
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

  const [
    profileResult,
    providerProfileResult,
    unreadConversationCountResult,
    conversationsResult,
    applicationsResult,
    workroomsResult,
    serviceRequestsResult,
    servicesResult,
    applicationCountResult,
    activeApplicationCountResult,
    shortlistedCountResult,
    acceptedCountResult,
  ] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, avatar_url, country, city")
        .eq("id", user.id)
        .single(),
      supabase
        .from("provider_profiles")
        .select(
          "provider_type, years_of_experience, portfolio_url, social_link, service_categories, service_category_other_text, about",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getUnreadConversationCount(supabase, user.id),
      getUserConversations(supabase, user.id, { limit: 3 }),
      supabase
        .from("applications")
        .select(
          "id, status, proposed_price, estimated_delivery_days, created_at, project:projects!applications_project_id_fkey(id, title, slug, status, deadline_date)",
        )
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5),
      getProviderWorkroomPreview(supabase, user.id),
      getProviderPendingServiceRequestPreview(supabase, user.id),
      supabase
        .from("provider_service_listings")
        .select("id, title, status")
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false })
        .limit(3),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id).in("status", ["pending", "viewed", "shortlisted"]),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id).eq("status", "shortlisted"),
      supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id).eq("status", "accepted"),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message ?? "Profile could not be loaded.");
  }

  if (providerProfileResult.error || !providerProfileResult.data) {
    throw new Error(
      providerProfileResult.error?.message ?? "Provider profile could not be loaded.",
    );
  }

  if (unreadConversationCountResult.error) {
    throw new Error(unreadConversationCountResult.error);
  }

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }

  if (workroomsResult.error) {
    throw new Error(workroomsResult.error);
  }

  if (serviceRequestsResult.error) {
    throw new Error(serviceRequestsResult.error);
  }

  if (servicesResult.error) {
    throw new Error(servicesResult.error.message);
  }

  for (const result of [applicationCountResult, activeApplicationCountResult, shortlistedCountResult, acceptedCountResult]) {
    if (result.error) throw new Error(result.error.message);
  }

  const profile = profileResult.data;
  const providerProfile = providerProfileResult.data;
  const unreadConversationCount = unreadConversationCountResult.data ?? 0;
  const conversations = conversationsResult.data ?? [];
  const workrooms = workroomsResult.data ?? [];
  const services = servicesResult.data ?? [];
  const pendingServiceRequests = serviceRequestsResult.data?.requests ?? [];
  const pendingServiceRequestCount = serviceRequestsResult.data?.totalCount ?? 0;
  const applications =
    (applicationsResult.data ?? []).map((item) => ({
      ...item,
      project: Array.isArray(item.project) ? item.project[0] ?? null : item.project,
    })) ?? [];
  const isReady = isProviderProfileReady(providerProfile);

  const unreadNames = conversations
    .filter((conversation) => conversation.unread_count > 0)
    .map((conversation) => conversationPartner(conversation, user.id)?.full_name)
    .filter((name): name is string => Boolean(name));
  const needs: NeedsItem[] = [
    ...pendingServiceRequests.map((request) => ({
      id: `request-${request.id}`,
      title: `${request.client?.full_name ?? "A client"} requested ${request.service?.title ?? "your service"}`,
      detail: "Service request waiting for your answer",
      actionLabel: "Review request",
      href: `/dashboard/service-requests/${request.id}`,
      person: {
        name: request.client?.full_name ?? "Client",
        avatarPath: request.client?.avatar_url ?? null,
      },
    })),
    ...(pendingServiceRequestCount > pendingServiceRequests.length
      ? [{
          id: "more-requests",
          title: `${pendingServiceRequestCount - pendingServiceRequests.length} more service requests`,
          detail: "Also waiting for your answer",
          actionLabel: "View requests",
          href: "/dashboard/provider/service-requests?status=pending",
          icon: "proposals" as const,
        }]
      : []),
    ...(unreadConversationCount > 0
      ? [{
          id: "unread",
          title: `${unreadConversationCount} unread conversation${unreadConversationCount === 1 ? "" : "s"}`,
          detail: unreadNames.length > 0 ? joinNames(unreadNames) : "Clients waiting for your reply",
          actionLabel: "Reply",
          href: "/dashboard/messages",
          icon: "message" as const,
        }]
      : []),
    ...(!isReady
      ? [{
          id: "profile",
          title: "Finish your profile",
          detail: "Add your experience, portfolio and services. Clients check it before they hire.",
          actionLabel: "Complete profile",
          href: "/dashboard/provider/profile",
          icon: "profile" as const,
        }]
      : []),
  ];

  return (
    <DashboardShell
      navItems={[
        { href: "/dashboard/provider", label: "Overview", active: true },
        {
          href: "/dashboard/provider/applications",
          label: "Applications",
          count: applicationCountResult.count ?? 0,
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
          action={{ href: "/jobs", label: "Browse jobs", icon: "search" }}
        />

        <NeedsYouCard
          items={needs}
          caughtUpText="New service requests and messages will show up here."
        />

        <StatLinks
          stats={[
            { label: "Submitted", value: applicationCountResult.count ?? 0, href: "/dashboard/provider/applications" },
            { label: "Active", value: activeApplicationCountResult.count ?? 0, href: "/dashboard/provider/applications?status=active" },
            { label: "Shortlisted", value: shortlistedCountResult.count ?? 0, href: "/dashboard/provider/applications?status=active" },
            { label: "Accepted", value: acceptedCountResult.count ?? 0, href: "/dashboard/provider/applications?status=accepted" },
          ]}
        />

        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:gap-6">
          <div className="min-w-0 lg:flex-1">
            <OverviewPanel
              id="applications-heading"
              title="Recent applications"
              viewAllHref={applications.length > 0 ? "/dashboard/provider/applications" : undefined}
            >
              {applications.length > 0 ? (
                <OverviewRows>
                  {applications.map((application) => (
                    <OverviewRow
                      key={application.id}
                      href={application.project ? `/jobs/${application.project.id}` : "/dashboard/provider/applications"}
                      title={application.project?.title ?? "Untitled project"}
                      detail={[
                        `Submitted ${formatShortDate(application.created_at)}`,
                        application.proposed_price != null ? priceFormatter.format(application.proposed_price) : null,
                        application.estimated_delivery_days != null
                          ? `${application.estimated_delivery_days} day${application.estimated_delivery_days === 1 ? "" : "s"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                      chip={
                        <StatusChip
                          label={getApplicationStatusMeta(application.status).label}
                          tone={applicationTones[application.status] ?? "neutral"}
                        />
                      }
                    />
                  ))}
                </OverviewRows>
              ) : (
                <PanelEmpty
                  text="You haven't applied to a project yet. Clients post new briefs every day, from photo shoots to home repairs."
                  link={{ href: "/jobs", label: "Find a project to apply to" }}
                />
              )}
            </OverviewPanel>
          </div>

          <aside aria-label="Workrooms, messages and services" className="flex min-w-0 flex-col gap-4 lg:w-80 lg:shrink-0 lg:gap-6">
            <WorkroomsPanel workrooms={workrooms} role="provider" />
            <MessagesPanel conversations={conversations} userId={user.id} role="provider" />
            <OverviewPanel
              id="services-heading"
              title="Your services"
              viewAllHref={services.length > 0 ? "/dashboard/provider/services" : undefined}
            >
              {services.length > 0 ? (
                <OverviewRows>
                  {services.map((service) => {
                    const status = serviceStatus[service.status] ?? serviceStatus.draft;

                    return (
                      <OverviewRow
                        key={service.id}
                        href={`/dashboard/provider/services/${service.id}`}
                        title={service.title}
                        chip={<StatusChip label={status.label} tone={status.tone} />}
                      />
                    );
                  })}
                </OverviewRows>
              ) : (
                <PanelEmpty
                  text="Services are how clients find and hire you directly. Publish one with a clear price."
                  link={{ href: "/dashboard/provider/services/post", label: "Create a service" }}
                />
              )}
            </OverviewPanel>
          </aside>
        </div>
      </div>
    </DashboardShell>
  );
}
