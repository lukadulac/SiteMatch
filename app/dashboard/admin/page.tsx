import Link from "next/link";
import { AdminAuditList } from "@/components/admin/admin-audit-list";
import { getAdminOverview, getAdminRecords } from "@/lib/admin/service";
import { adminListSchemas, adminOverviewSchema } from "@/lib/admin/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const [overviewResult, auditResult] = await Promise.all([
    getAdminOverview(supabase),
    getAdminRecords(supabase, { resource: "audit", page: 1, filter: "all" }),
  ]);
  if (overviewResult.error || auditResult.error) {
    throw new Error(overviewResult.error ?? auditResult.error ?? "Admin overview could not be loaded.");
  }

  const overview = adminOverviewSchema.parse(overviewResult.data);
  const audit = adminListSchemas.audit.parse(auditResult.data);
  const stats = [
    { label: "Users", value: overview.users, href: "/dashboard/admin/users" },
    { label: "Services", value: overview.services, href: "/dashboard/admin/services" },
    { label: "Projects", value: overview.projects, href: "/dashboard/admin/projects" },
    { label: "Hidden services", value: overview.hiddenServices, href: "/dashboard/admin/services?filter=hidden" },
    { label: "Hidden projects", value: overview.hiddenProjects, href: "/dashboard/admin/projects?filter=hidden" },
    { label: "Auth deletions pending", value: overview.pendingAuthDeletions, href: "/dashboard/admin/users?filter=deleted" },
  ];

  return (
    <div className="space-y-8">
      <header>
        <p className="text-sm text-secondary">Admin / Overview</p>
        <h1 className="mt-2 text-3xl font-semibold text-black">Operations overview</h1>
      </header>

      <section aria-label="Marketplace totals" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {stats.map((stat) => (
          <Link key={stat.label} href={stat.href} className="rounded-md border border-line bg-white p-5 transition hover:border-violet-300 focus-visible:outline-2 focus-visible:outline-violet-600">
            <p className="text-sm text-secondary">{stat.label}</p>
            <p className="mt-3 text-3xl font-semibold tabular-nums text-black">{stat.value.toLocaleString()}</p>
          </Link>
        ))}
      </section>

      <section aria-labelledby="recent-actions" className="border-t border-line pt-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 id="recent-actions" className="text-xl font-semibold text-black">Recent decisions</h2>
          <Link href="/dashboard/admin/audit" className="text-sm font-semibold text-violet-700 hover:underline">View audit log</Link>
        </div>
        <AdminAuditList items={audit.items.slice(0, 5)} />
      </section>
    </div>
  );
}
