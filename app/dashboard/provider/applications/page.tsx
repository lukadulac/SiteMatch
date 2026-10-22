import Link from "next/link";
import { redirect } from "next/navigation";
import { openProviderApplicationConversationAction } from "@/app/jobs/actions";
import { withdrawApplicationAction } from "@/app/dashboard/actions";
import { ActionSubmitButton } from "@/components/dashboard/ActionSubmitButton";
import { DashboardListPagination, DashboardStatusFilters, DASHBOARD_LIST_PAGE_SIZE, dashboardListHref, parseDashboardPage, parseDashboardStatus } from "@/components/dashboard/DashboardListControls";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUnreadConversationCount } from "@/lib/messaging/service";
import {
  canMessageForApplicationStatus,
  canWithdrawForApplicationStatus,
  getApplicationStatusMeta,
  type ApplicationStatus,
} from "@/lib/projects/application-status";
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

type ProviderApplicationListItem = {
  id: string;
  status: ApplicationStatus;
  proposed_price: number | null;
  estimated_delivery_days: number | null;
  created_at: string;
  project: {
    id: string;
    title: string;
    slug: string;
    status: string;
    deadline_date: string | null;
  } | null;
};

function ApplicationSummaryCard({
  label,
  value,
  detail,
}: {
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <article className="min-w-0 rounded-3xl border border-line bg-white p-5 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
      <p className="text-3xl font-semibold text-black">{value}</p>
      <p className="mt-3 text-sm font-semibold text-black">{label}</p>
      <p className="mt-1 text-sm leading-5 text-secondary">{detail}</p>
    </article>
  );
}

function ProviderApplicationCard({
  application,
  conversationId,
}: {
  application: ProviderApplicationListItem;
  conversationId?: string;
}) {
  const statusMeta = getApplicationStatusMeta(application.status);
  const messageAction = application.project
    ? openProviderApplicationConversationAction.bind(
        null,
        application.project.id,
        application.id,
      )
    : null;

  return (
    <article className="rounded-3xl border border-line bg-white p-5">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div className="min-w-0">
          <h2 className="wrap-break-word text-xl font-semibold text-black">
            {application.project?.title ?? "Untitled project"}
          </h2>
          <p className="mt-2 text-sm text-secondary">
            Submitted on {formatDateLabel(application.created_at)}
          </p>
        </div>
        <span
          className={`inline-flex shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${applicationStatusClasses(
            application.status,
          )}`}
        >
          {statusMeta.label}
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

      {application.project ? (
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            href={`/jobs/${application.project.id}`}
            className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
          >
            View brief
          </Link>
          {canMessageForApplicationStatus(application.status) && messageAction ? (
            <form action={messageAction}>
              <button
                type="submit"
                className="rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Message client
              </button>
            </form>
          ) : conversationId ? (
            <Link
              href={`/dashboard/messages/${conversationId}`}
              className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
            >
              View conversation
            </Link>
          ) : null}
          {canWithdrawForApplicationStatus(application.status) ? (
            <form action={withdrawApplicationAction.bind(null, application.id)}>
              <ActionSubmitButton
                label="Withdraw proposal"
                pendingLabel="Withdrawing..."
                confirmMessage="Withdraw this proposal? You may not be able to reapply."
                destructive
                className="rounded-lg border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              />
            </form>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

function ApplicationSection({
  title,
  description,
  applications,
  conversationByApplicationId,
  emptyMessage,
  totalCount,
}: {
  title: string;
  description: string;
  applications: ProviderApplicationListItem[];
  conversationByApplicationId: Map<string, string>;
  emptyMessage: string;
  totalCount: number;
}) {
  return (
    <DashboardPanel
      title={title}
      action={
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-secondary">
          {totalCount}
        </span>
      }
    >
      <p className="mb-5 text-sm leading-6 text-secondary">{description}</p>
      <div className="space-y-4">
        {applications.length > 0 ? (
          applications.map((application) => (
            <ProviderApplicationCard
              key={application.id}
              application={application}
              conversationId={conversationByApplicationId.get(application.id)}
            />
          ))
        ) : (
          <div className="rounded-3xl border border-dashed border-line p-6 text-sm leading-6 text-secondary">
            {emptyMessage}
          </div>
        )}
      </div>
    </DashboardPanel>
  );
}

export default async function ProviderApplicationsPage({ searchParams }: { searchParams: Promise<{ status?: string | string[]; page?: string | string[] }> }) {
  const params = await searchParams;
  const status = parseDashboardStatus(params.status, ["all", "active", "accepted", "closed"] as const);
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

  if (provisioned.role !== "provider") {
    redirect(getDashboardPath(provisioned.role));
  }

  const applicationStatuses = status === "active" ? ["pending", "viewed", "shortlisted"] as const : status === "closed" ? ["rejected", "withdrawn"] as const : null;
  const [totalCountResult, activeCountResult, acceptedCountResult, closedCountResult, unreadCountResult] = await Promise.all([
    (() => {
      let query = supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id);
      if (applicationStatuses) query = query.in("status", [...applicationStatuses]);
      if (status === "accepted") query = query.eq("status", "accepted");
      return query;
    })(),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id).in("status", ["pending", "viewed", "shortlisted"]),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id).eq("status", "accepted"),
    supabase.from("applications").select("id", { count: "exact", head: true }).eq("provider_id", user.id).in("status", ["rejected", "withdrawn"]),
    getUnreadConversationCount(supabase, user.id),
  ]);

  for (const result of [totalCountResult, activeCountResult, acceptedCountResult, closedCountResult]) {
    if (result.error) throw new Error(result.error.message);
  }
  if (unreadCountResult.error) throw new Error(unreadCountResult.error);
  const totalCount = totalCountResult.count ?? 0;
  const activeCount = activeCountResult.count ?? 0;
  const acceptedCount = acceptedCountResult.count ?? 0;
  const closedCount = closedCountResult.count ?? 0;
  const totalPages = Math.ceil(totalCount / DASHBOARD_LIST_PAGE_SIZE);
  if (page > Math.max(1, totalPages)) redirect(dashboardListHref("/dashboard/provider/applications", status, Math.max(1, totalPages)));

  let applicationsQuery = supabase.from("applications")
    .select("id, status, proposed_price, estimated_delivery_days, created_at, project:projects!applications_project_id_fkey(id, title, slug, status, deadline_date)")
    .eq("provider_id", user.id);
  if (applicationStatuses) applicationsQuery = applicationsQuery.in("status", [...applicationStatuses]);
  if (status === "accepted") applicationsQuery = applicationsQuery.eq("status", "accepted");
  const applicationsResult = await applicationsQuery.order("created_at", { ascending: false }).order("id", { ascending: false }).range((page - 1) * DASHBOARD_LIST_PAGE_SIZE, page * DASHBOARD_LIST_PAGE_SIZE - 1);
  if (applicationsResult.error) throw new Error(applicationsResult.error.message);
  const applications =
    (applicationsResult.data ?? []).map((item) => ({
      ...item,
      project: Array.isArray(item.project) ? item.project[0] ?? null : item.project,
    })) ?? [];
  const conversationByApplicationId = new Map<string, string>();
  if (applications.length > 0) {
    const conversationsResult = await supabase.from("conversations")
      .select("id, application_id")
      .eq("provider_id", user.id)
      .in("application_id", applications.map((application) => application.id));
    if (conversationsResult.error) throw new Error(conversationsResult.error.message);
    for (const conversation of conversationsResult.data ?? []) {
      if (conversation.application_id) conversationByApplicationId.set(conversation.application_id, conversation.id);
    }
  }
  const unreadConversationCount = unreadCountResult.data ?? 0;

  return (
    <DashboardShell
      title="Applications"
      subtitle="Track submitted proposals, shortlisted opportunities, accepted work, and closed applications."
      actionHref="/jobs"
      actionLabel="Browse Jobs"
      navItems={[
        { href: "/dashboard/provider", label: "Overview" },
        {
          href: "/dashboard/provider/applications",
          label: "Applications",
          count: totalCount,
          active: true,
        },
        { href: "/dashboard/provider/services", label: "Services" },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversationCount,
        },
        { href: "/dashboard/provider/profile", label: "Profile" },
      ]}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <ApplicationSummaryCard
          label="Active proposals"
          value={String(activeCount)}
          detail="Pending, viewed, or shortlisted proposals"
        />
        <ApplicationSummaryCard
          label="Accepted work"
          value={String(acceptedCount)}
          detail="Projects where the client selected your proposal"
        />
        <ApplicationSummaryCard
          label="Closed proposals"
          value={String(closedCount)}
          detail="Rejected or withdrawn applications"
        />
      </section>

      <DashboardStatusFilters basePath="/dashboard/provider/applications" status={status} options={[{ value: "all", label: "All" }, { value: "active", label: "Active" }, { value: "accepted", label: "Accepted" }, { value: "closed", label: "Closed" }]} />
      <ApplicationSection
        title="My Applications"
        description="Review proposals and open their project or conversation."
        applications={applications}
        conversationByApplicationId={conversationByApplicationId}
        emptyMessage={status === "all" ? "No applications yet. Browse open briefs to send your first proposal." : "No applications match this status."}
        totalCount={totalCount}
      />
      <DashboardListPagination basePath="/dashboard/provider/applications" status={status} page={page} totalPages={totalPages} />
    </DashboardShell>
  );
}
