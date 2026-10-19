import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminAuditList } from "@/components/admin/admin-audit-list";
import { AdminRecordsTable } from "@/components/admin/admin-records-table";
import { getAdminRecords } from "@/lib/admin/service";
import {
  adminFilters,
  adminListSchemas,
  adminListUrl,
  isAdminResource,
  parseAdminListParams,
  parseAdminListResponse,
} from "@/lib/admin/ui";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const titles = {
  users: "Users",
  projects: "Projects",
  services: "Service listings",
  audit: "Audit log",
};

export default async function AdminRecordsPage({
  params,
  searchParams,
}: {
  params: Promise<{ resource: string }>;
  searchParams: Promise<{ filter?: string | string[]; page?: string | string[] }>;
}) {
  const { resource } = await params;
  if (!isAdminResource(resource)) notFound();

  const query = parseAdminListParams(resource, await searchParams);
  if (query.normalized) redirect(adminListUrl(resource, query.filter, query.page));

  const result = await getAdminRecords(await createSupabaseServerClient(), {
    resource, page: query.page, filter: query.filter,
  });
  if (result.error) throw new Error(result.error);

  const list = parseAdminListResponse(resource, result.data);
  const totalPages = Math.max(1, Math.ceil(list.totalCount / list.pageSize));
  if (query.page > totalPages) redirect(adminListUrl(resource, query.filter, totalPages));

  return (
    <div className="space-y-6">
      <header className="border-b border-line pb-5">
        <p className="text-sm text-secondary">Admin / {titles[resource]}</p>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <h1 className="text-3xl font-semibold text-black">{titles[resource]}</h1>
          <span className="text-sm tabular-nums text-secondary">{list.totalCount.toLocaleString()} total</span>
        </div>
      </header>

      {resource !== "audit" && (
        <nav aria-label={`${titles[resource]} filters`} className="flex gap-2 overflow-x-auto pb-1">
          {adminFilters(resource).map((filter) => (
            <Link
              key={filter}
              href={adminListUrl(resource, filter)}
              aria-current={query.filter === filter ? "page" : undefined}
              className={`shrink-0 rounded-md px-3 py-2 text-sm font-medium capitalize ${
                query.filter === filter ? "bg-violet-600 text-white" : "bg-white text-secondary hover:bg-zinc-100"
              }`}
            >
              {filter}
            </Link>
          ))}
        </nav>
      )}

      {resource === "audit" ? (
        <AdminAuditList items={adminListSchemas.audit.parse(result.data).items} />
      ) : (
        <AdminRecordsTable resource={resource} data={result.data} />
      )}

      <nav aria-label="Admin list pagination" className="flex items-center justify-between gap-3 border-t border-line pt-4 text-sm">
        {query.page > 1 ? (
          <Link href={adminListUrl(resource, query.filter, query.page - 1)} aria-label="Previous page" className="rounded-md border border-line bg-white px-4 py-2 font-medium hover:border-violet-400">Previous</Link>
        ) : <span aria-disabled="true" className="rounded-md border border-line px-4 py-2 text-secondary opacity-50">Previous</span>}
        <span className="text-center tabular-nums text-secondary">Page {query.page} of {totalPages}</span>
        {query.page < totalPages ? (
          <Link href={adminListUrl(resource, query.filter, query.page + 1)} aria-label="Next page" className="rounded-md border border-line bg-white px-4 py-2 font-medium hover:border-violet-400">Next</Link>
        ) : <span aria-disabled="true" className="rounded-md border border-line px-4 py-2 text-secondary opacity-50">Next</span>}
      </nav>
    </div>
  );
}
