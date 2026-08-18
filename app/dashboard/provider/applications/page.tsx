import Link from "next/link";
import { redirect } from "next/navigation";
import { withdrawApplicationAction } from "@/app/dashboard/actions";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
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

function canWithdrawApplication(status: string) {
  return status === "pending" || status === "viewed" || status === "shortlisted";
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
      <DashboardPanel title="My Applications">
        <div className="space-y-4">
          {applications.length > 0 ? (
            applications.map((application) => (
              <article
                key={application.id}
                className="rounded-3xl border border-line bg-white p-5"
              >
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

                {application.project ? (
                  <div className="mt-5 flex flex-wrap gap-3">
                    <Link
                      href={`/jobs/${application.project.id}`}
                      className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                    >
                      View brief
                    </Link>
                    {canWithdrawApplication(application.status) ? (
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
            ))
          ) : (
            <div className="rounded-3xl border border-dashed border-line p-8 text-sm text-secondary">
              You have not submitted applications yet. Browse open briefs and send
              your first proposal.
            </div>
          )}
        </div>
      </DashboardPanel>
    </DashboardShell>
  );
}
