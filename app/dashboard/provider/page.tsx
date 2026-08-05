import Link from "next/link";
import { redirect } from "next/navigation";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
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
  const activeApplications = applications.filter((application) =>
    ["pending", "viewed", "shortlisted", "accepted"].includes(application.status),
  );
  const isReady = isProviderProfileReady(providerProfile);

  return (
    <DashboardShell
      title="Dashboard"
      subtitle={`Welcome back, ${
        profile.full_name.split(" ")[0] || "Provider"
      }. Here's what's happening today.`}
      actionHref="/jobs"
      actionLabel="Browse Jobs"
      navItems={[
        { href: "/dashboard/provider", label: "Overview", active: true },
        {
          href: "/dashboard/provider/applications",
          label: "Applications",
          count: applications.length,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/provider/profile", label: "Profile" },
      ]}
    >
      {!isReady ? (
        <section className="flex flex-col gap-3 rounded-[1.5rem] border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-semibold">
            Complete your profile to improve visibility with clients.
          </p>
          <Link href="/dashboard/provider/profile" className="font-semibold underline">
            Complete
          </Link>
        </section>
      ) : null}

      <section className="grid min-w-0 gap-4 md:grid-cols-3">
        <OverviewStat
          label="Submitted Applications"
          value={String(applications.length)}
          detail={`${activeApplications.length} currently active`}
        />
        <OverviewStat
          label="Shortlisted"
          value={String(shortlistedApplications.length)}
          detail="Clients have marked these proposals as promising"
        />
        <OverviewStat
          label="Unread Messages"
          value={String(unreadConversations.length)}
          detail="Client conversations needing a reply"
        />
      </section>

      <section className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 rounded-[1.75rem] border border-line bg-white shadow-[0_16px_45px_rgba(17,17,17,0.05)]">
          <div className="flex min-w-0 items-center justify-between gap-4 border-b border-line px-5 py-4">
            <h2 className="min-w-0 break-words text-xl font-semibold text-black">
              Recent Applications
            </h2>
            <Link
              href="/dashboard/provider/applications"
              className="shrink-0 text-sm font-semibold text-black transition hover:opacity-70"
            >
              View All
            </Link>
          </div>

          <div className="divide-y divide-line">
            {applications.length > 0 ? (
              applications.slice(0, 5).map((application) => (
                <article
                  key={application.id}
                  className="flex min-w-0 flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="break-words text-base font-semibold text-black">
                        {application.project?.title ?? "Untitled project"}
                      </h3>
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${applicationStatusClasses(
                          application.status,
                        )}`}
                      >
                        {applicationStatusLabel(application.status)}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-1 text-sm text-secondary">
                      Submitted {formatDateLabel(application.created_at)} ·{" "}
                      {application.proposed_price != null
                        ? `$${application.proposed_price.toLocaleString()}`
                        : "Price not specified"}
                    </p>
                  </div>

                  <div className="flex min-w-0 items-center justify-between gap-4 md:shrink-0 md:justify-start">
                    <div className="text-right text-sm">
                      <p className="font-semibold text-black">
                        {application.estimated_delivery_days != null
                          ? application.estimated_delivery_days
                          : "--"}
                      </p>
                      <p className="text-xs text-secondary">Days</p>
                    </div>
                    {application.project ? (
                      <Link
                        href={`/jobs/${application.project.id}`}
                        className="shrink-0 rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                      >
                        View
                      </Link>
                    ) : null}
                  </div>
                </article>
              ))
            ) : (
              <div className="p-8 text-sm leading-6 text-secondary">
                You have not submitted applications yet. Browse open briefs and
                send your first proposal.
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
                    conversation.client_id === user.id
                      ? conversation.provider
                      : conversation.client;

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
              isReady ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
            }`}
          >
            <p className="text-sm font-semibold text-black">Profile Status</p>
            <p className="mt-2 text-sm leading-6 text-secondary">
              {isReady
                ? "Your provider profile is ready."
                : "Finish your provider profile before heavy testing."}
            </p>
            <Link
              href="/dashboard/provider/profile"
              className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
            >
              Manage profile
            </Link>
          </section>

          <section className="min-w-0 rounded-[1.75rem] border border-line bg-white p-5 shadow-[0_16px_45px_rgba(17,17,17,0.05)]">
            <p className="text-sm font-semibold text-black">Accepted Work</p>
            <p className="mt-2 text-3xl font-semibold text-black">
              {acceptedApplications.length}
            </p>
            <p className="mt-2 text-sm leading-6 text-secondary">
              Projects you have already secured.
            </p>
          </section>
        </aside>
      </section>
    </DashboardShell>
  );
}
