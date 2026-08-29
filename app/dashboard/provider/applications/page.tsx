import Link from "next/link";
import { redirect } from "next/navigation";
import { openProviderApplicationConversationAction } from "@/app/jobs/actions";
import { withdrawApplicationAction } from "@/app/dashboard/actions";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
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
              <button
                type="submit"
                className="rounded-2xl border border-red-100 px-4 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
              >
                Withdraw proposal
              </button>
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
}: {
  title: string;
  description: string;
  applications: ProviderApplicationListItem[];
  conversationByApplicationId: Map<string, string>;
  emptyMessage: string;
}) {
  return (
    <DashboardPanel
      title={title}
      action={
        <span className="shrink-0 rounded-full bg-zinc-100 px-3 py-1 text-sm font-semibold text-secondary">
          {applications.length}
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

export default async function ProviderApplicationsPage() {
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

  const [conversationsResult, applicationsResult] = await Promise.all([
    getUserConversations(supabase, user.id),
    supabase
      .from("applications")
      .select(
        "id, status, proposed_price, estimated_delivery_days, created_at, project:projects!applications_project_id_fkey(id, title, slug, status, deadline_date)",
      )
      .eq("provider_id", user.id)
      .order("created_at", { ascending: false }),
  ]);

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }

  const conversations = conversationsResult.data ?? [];
  const applications =
    (applicationsResult.data ?? []).map((item) => ({
      ...item,
      project: Array.isArray(item.project) ? item.project[0] ?? null : item.project,
    })) ?? [];
  const conversationByApplicationId = new Map<string, string>();

  for (const conversation of conversations) {
    if (conversation.application_id) {
      conversationByApplicationId.set(conversation.application_id, conversation.id);
    }
  }

  const activeApplications = applications.filter((application) =>
    ["pending", "viewed", "shortlisted"].includes(application.status),
  );
  const acceptedApplications = applications.filter(
    (application) => application.status === "accepted",
  );
  const closedApplications = applications.filter((application) =>
    ["rejected", "withdrawn"].includes(application.status),
  );
  const unreadConversations = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  );

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
          count: applications.length,
          active: true,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/provider/profile", label: "Profile" },
      ]}
    >
      <section className="grid gap-4 md:grid-cols-3">
        <ApplicationSummaryCard
          label="Active proposals"
          value={String(activeApplications.length)}
          detail="Pending, viewed, or shortlisted proposals"
        />
        <ApplicationSummaryCard
          label="Accepted work"
          value={String(acceptedApplications.length)}
          detail="Projects where the client selected your proposal"
        />
        <ApplicationSummaryCard
          label="Closed proposals"
          value={String(closedApplications.length)}
          detail="Rejected or withdrawn applications"
        />
      </section>

      {applications.length > 0 ? (
        <div className="space-y-6">
          <ApplicationSection
            title="Active Proposals"
            description="Open applications where you can still message the client or withdraw your proposal."
            applications={activeApplications}
            conversationByApplicationId={conversationByApplicationId}
            emptyMessage="No active proposals right now."
          />
          <ApplicationSection
            title="Accepted Work"
            description="Projects where your proposal was accepted. These stay separate from open applications."
            applications={acceptedApplications}
            conversationByApplicationId={conversationByApplicationId}
            emptyMessage="No accepted work yet."
          />
          <ApplicationSection
            title="Closed Proposals"
            description="Rejected and withdrawn proposals remain visible for history, but messaging is read-only."
            applications={closedApplications}
            conversationByApplicationId={conversationByApplicationId}
            emptyMessage="No closed proposals yet."
          />
        </div>
      ) : (
        <DashboardPanel title="My Applications">
          <div className="rounded-3xl border border-dashed border-line p-8 text-sm text-secondary">
            You have not submitted applications yet. Browse open briefs and send
            your first proposal.
          </div>
        </DashboardPanel>
      )}
    </DashboardShell>
  );
}
