import { redirect } from "next/navigation";
import {
  DashboardPanel,
  DashboardShell,
  DashboardStatCard,
} from "@/components/dashboard/DashboardShell";
import { ProviderProfileForm } from "@/components/dashboard/provider-profile-form";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatTimeAgo(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffHours = Math.max(1, Math.floor(diffMs / (1000 * 60 * 60)));

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
}

function formatDateLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(new Date(value));
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

  const [profileResult, providerProfileResult, conversationsResult, applicationsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, country, city")
        .eq("id", user.id)
        .single(),
      supabase
        .from("provider_profiles")
        .select(
          "provider_type, tax_id, years_of_experience, portfolio_url, social_link, service_categories, service_category_other_text, about, average_rating, total_reviews, is_verified",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getUserConversations(supabase, user.id),
      supabase
        .from("applications")
        .select(
          "id, status, proposed_price, estimated_delivery_days, created_at, project:projects!applications_project_id_fkey(id, title, slug, status, deadline_date)",
        )
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false }),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message ?? "Profile could not be loaded.");
  }

  if (providerProfileResult.error || !providerProfileResult.data) {
    throw new Error(
      providerProfileResult.error?.message ?? "Provider profile could not be loaded.",
    );
  }

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }

  const profile = profileResult.data;
  const providerProfile = providerProfileResult.data;
  const conversations = conversationsResult.data ?? [];
  const applications =
    (applicationsResult.data ?? []).map((item) => ({
      ...item,
      project: Array.isArray(item.project) ? item.project[0] ?? null : item.project,
    })) ?? [];
  const unreadConversations = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  );
  const shortlistedApplications = applications.filter(
    (application) => application.status === "shortlisted",
  );
  const acceptedApplications = applications.filter(
    (application) => application.status === "accepted",
  );
  const isReady = isProviderProfileReady(providerProfile);

  return (
    <DashboardShell
      title={`Welcome back, ${profile.full_name.split(" ")[0] || "Provider"}!`}
      subtitle="Manage your provider profile, active opportunities, and conversations with clients from one place."
      navItems={[
        { href: "/dashboard/provider", label: "Overview", active: true },
        {
          href: "/dashboard/provider#applications",
          label: "Applications",
          count: applications.length,
        },
        {
          href: "/dashboard/provider#messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/provider#profile", label: "Profile" },
      ]}
    >
      <div className="grid gap-5 xl:grid-cols-4">
        <DashboardStatCard
          value={String(applications.length)}
          label="Applications"
          detail={`${shortlistedApplications.length} shortlisted right now`}
        />
        <DashboardStatCard
          value={String(acceptedApplications.length)}
          label="Accepted Deals"
          detail="Projects you have already secured"
        />
        <DashboardStatCard
          value={String(conversations.length)}
          label="Conversations"
          detail={`${unreadConversations.length} with unread updates`}
        />
        <DashboardStatCard
          value={providerProfile.is_verified ? "Verified" : "Pending"}
          label="Verification"
          detail={
            providerProfile.is_verified
              ? "Provider identity is verified"
              : "Verification still in progress"
          }
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(320px,0.9fr)]">
        <DashboardPanel title="Recent Applications">
          <div id="applications" className="space-y-4">
            {applications.length > 0 ? (
              applications.slice(0, 4).map((application) => (
                <article
                  key={application.id}
                  className="rounded-[1.5rem] border border-line p-5"
                >
                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-black">
                        {application.project?.title ?? "Untitled project"}
                      </h3>
                      <p className="mt-2 text-sm text-secondary">
                        Submitted on {formatDateLabel(application.created_at)}
                      </p>
                    </div>
                    <span
                      className={`inline-flex rounded-full px-4 py-2 text-sm font-semibold ${applicationStatusClasses(
                        application.status,
                      )}`}
                    >
                      {applicationStatusLabel(application.status)}
                    </span>
                  </div>

                  <div className="mt-5 grid gap-4 text-sm text-secondary md:grid-cols-3">
                    <p>
                      Proposed price:{" "}
                      {application.proposed_price != null
                        ? `$${application.proposed_price.toLocaleString()}`
                        : "Not specified"}
                    </p>
                    <p>
                      Delivery:{" "}
                      {application.estimated_delivery_days != null
                        ? `${application.estimated_delivery_days} days`
                        : "Flexible"}
                    </p>
                    <p>
                      Deadline:{" "}
                      {application.project?.deadline_date
                        ? formatDateLabel(application.project.deadline_date)
                        : "Not set"}
                    </p>
                  </div>
                </article>
              ))
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-line p-8 text-sm text-secondary">
                You have not submitted applications yet. Once you start applying
                to projects, they will appear here.
              </div>
            )}
          </div>
        </DashboardPanel>

        <DashboardPanel title="Messages">
          <div id="messages" className="space-y-4">
            {conversations.length > 0 ? (
              conversations.slice(0, 4).map((conversation) => {
                const otherParty =
                  conversation.client_id === user.id
                    ? conversation.provider
                    : conversation.client;

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
              })
            ) : (
              <div className="rounded-[1.5rem] border border-dashed border-line p-8 text-sm text-secondary">
                No conversations yet. When clients contact you, your messages
                will show up here.
              </div>
            )}
          </div>
        </DashboardPanel>
      </div>

      <div
        id="profile"
        className={`rounded-[2rem] border p-5 sm:p-6 ${
          isReady ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-black">
          Profile progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-black">
          {isReady
            ? "Your provider profile is ready"
            : "Finish your provider profile"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
          {isReady
            ? "Your provider profile contains the key details clients need before reaching out."
            : "Complete the remaining provider fields below so your public-facing information and matching signals are ready."}
        </p>
      </div>

      <DashboardPanel title="Provider Profile">
        <ProviderProfileForm profile={profile} providerProfile={providerProfile} />
      </DashboardPanel>
    </DashboardShell>
  );
}
