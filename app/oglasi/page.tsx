import Link from "next/link";
import { redirect } from "next/navigation";
import { ensureUserProfile } from "@/lib/auth/provision";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import { getDashboardPath } from "@/lib/auth/roles";
import { getClientProjects } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

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

function formatBudget(
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
    if (budgetMin != null) {
      return `Fixed: ${formatter.format(budgetMin)}`;
    }

    if (budgetMax != null) {
      return `Fixed: ${formatter.format(budgetMax)}`;
    }

    return "Fixed budget";
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

  return "Budget not specified";
}

export default async function ListingsPage() {
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

  const [projectsResult, clientProfileResult] = await Promise.all([
    getClientProjects(supabase, user.id),
    supabase
      .from("client_profiles")
      .select(
        "business_name, business_type, business_type_text, project_idea, interested_solution_types, interested_solution_other_text",
      )
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  if (projectsResult.error) {
    throw new Error(projectsResult.error);
  }

  if (clientProfileResult.error) {
    throw new Error(clientProfileResult.error.message);
  }

  const projects = projectsResult.data ?? [];
  const activeCount = projects.filter((project) =>
    ["published", "in_discussion", "assigned"].includes(project.status),
  ).length;
  const draftCount = projects.filter((project) => project.status === "draft").length;
  const profileComplete = isClientProfileComplete(clientProfileResult.data);

  return (
    <section className="space-y-8 py-4 sm:py-8">
      <div className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-secondary">
              Client listings
            </p>
            <h1 className="mt-3 text-3xl font-semibold text-black sm:text-4xl">
              Manage your project briefs
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-secondary sm:text-base">
              This is the operating surface for client-side demand. Drafts help you
              shape the brief, published listings invite providers into the flow.
            </p>
          </div>

          <Link
            href="/oglasi/novi"
            className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
          >
            Create new listing
          </Link>
        </div>
      </div>

      {!profileComplete ? (
        <div className="rounded-[1.75rem] border border-amber-200 bg-amber-50/80 p-5 text-sm text-amber-900 shadow-[0_20px_60px_rgba(120,53,15,0.08)]">
          Your client profile is still incomplete. Finish it in{" "}
          <Link href="/dashboard/client#profile" className="font-semibold underline">
            dashboard profile settings
          </Link>{" "}
          so listings can be saved and published without backend validation errors.
        </div>
      ) : null}

      <div className="grid gap-5 md:grid-cols-3">
        {[
          {
            value: String(projects.length),
            label: "Total listings",
            detail: "All drafts and live opportunities",
          },
          {
            value: String(activeCount),
            label: "Active listings",
            detail: "Currently visible or in progress",
          },
          {
            value: String(draftCount),
            label: "Drafts",
            detail: "Private briefs still being shaped",
          },
        ].map((item) => (
          <article
            key={item.label}
            className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)]"
          >
            <p className="text-4xl font-semibold text-black">{item.value}</p>
            <p className="mt-3 text-base font-semibold text-black">{item.label}</p>
            <p className="mt-1 text-sm text-secondary">{item.detail}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-5">
        {projects.length > 0 ? (
          projects.map((project) => (
            <article
              key={project.id}
              className="rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)]"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <h2 className="text-2xl font-semibold text-black">{project.title}</h2>
                  <p className="mt-3 line-clamp-3 break-words text-sm leading-6 text-secondary sm:text-base">
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

              <div className="mt-6 grid gap-4 text-sm text-secondary md:grid-cols-2 xl:grid-cols-4">
                <p>Budget: {formatBudget(project.budget_type, project.budget_min, project.budget_max)}</p>
                <p>Deadline: {formatDateLabel(project.deadline_date)}</p>
                <p>Preferred start date: {formatDateLabel(project.desired_start_date)}</p>
                <p>Created: {formatDateLabel(project.created_at)}</p>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href={`/oglasi/${project.id}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                >
                  View details
                </Link>
                {project.status === "draft" || project.status === "published" ? (
                  <Link
                    href={`/oglasi/${project.id}/edit`}
                    className="inline-flex items-center justify-center rounded-2xl border border-line-strong bg-white px-4 py-2 text-sm font-semibold text-black transition hover:bg-black/3"
                  >
                    {project.status === "draft" ? "Continue editing" : "Edit listing"}
                  </Link>
                ) : null}
              </div>
            </article>
          ))
        ) : (
          <div className="rounded-4xl border border-dashed border-line-strong bg-white/80 p-10 text-center shadow-[0_16px_40px_rgba(17,17,17,0.03)]">
            <h2 className="text-2xl font-semibold text-black">No listings yet</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
              The backend flow is ready. The next useful step is to publish your first
              brief and validate the client-to-provider path with real data.
            </p>
            <Link
              href="/oglasi/novi"
              className="mt-6 inline-flex items-center justify-center rounded-2xl bg-black px-5 py-3 text-sm font-semibold text-white transition hover:bg-black/85"
            >
              Create your first listing
            </Link>
          </div>
        )}
      </div>
    </section>
  );
}
