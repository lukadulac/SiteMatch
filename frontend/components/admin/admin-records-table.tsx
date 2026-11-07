import { formatAdminDate } from "@/components/admin/admin-audit-list";
import { ModerationDialog } from "@/components/admin/moderation-dialog";
import { adminListSchemas, type AdminResource } from "@/lib/admin/ui";

type RecordResource = Exclude<AdminResource, "audit">;

function Status({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "warning" | "danger" | "success" }) {
  const styles = {
    neutral: "bg-zinc-100 text-zinc-700",
    warning: "bg-amber-50 text-amber-800",
    danger: "bg-red-50 text-red-700",
    success: "bg-emerald-50 text-emerald-700",
  };
  return <span className={`inline-flex rounded-sm px-2 py-1 text-xs font-semibold capitalize ${styles[tone]}`}>{label}</span>;
}

export function AdminRecordsTable({ resource, data }: { resource: RecordResource; data: unknown }) {
  if (resource === "users") {
    const { items } = adminListSchemas.users.parse(data);
    if (items.length === 0) return <p className="py-10 text-center text-sm text-secondary">No users match this filter.</p>;
    return (
      <div className="overflow-x-auto border-y border-line bg-white">
        <table className="w-full min-w-160 text-left text-sm">
          <thead className="border-b border-line bg-zinc-50 text-xs uppercase text-secondary"><tr><th scope="col" className="p-3">User</th><th scope="col" className="p-3">Role</th><th scope="col" className="p-3">Access</th><th scope="col" className="p-3">Joined</th><th scope="col" className="p-3">Action</th></tr></thead>
          <tbody className="divide-y divide-line">
            {items.map((item) => (
              <tr key={item.id}>
                <td className="p-3"><p className="font-semibold text-black">{item.full_name}</p><p className="break-all text-xs text-secondary">{item.email}</p></td>
                <td className="p-3 capitalize text-secondary">{item.role}</td>
                <td className="p-3"><Status label={item.access_enabled ? "Active" : item.moderation_status} tone={item.access_enabled ? "success" : item.moderation_status === "suspended" ? "warning" : "danger"} /></td>
                <td className="p-3 whitespace-nowrap text-secondary">{formatAdminDate(item.created_at)}</td>
                <td className="p-3">{item.role === "admin" ? <span className="text-xs text-secondary">Protected</span> : <ModerationDialog targetType="user" targetId={item.id} title={item.full_name} status={item.moderation_status} retryDeletion={item.moderation_status === "deleted" && !item.auth_deleted_at} />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  const items = resource === "projects"
    ? adminListSchemas.projects.parse(data).items
    : adminListSchemas.services.parse(data).items;
  if (items.length === 0) return <p className="py-10 text-center text-sm text-secondary">No listings match this filter.</p>;
  return (
    <div className="overflow-x-auto border-y border-line bg-white">
      <table className="w-full min-w-160 text-left text-sm">
        <thead className="border-b border-line bg-zinc-50 text-xs uppercase text-secondary"><tr><th scope="col" className="p-3">Listing</th><th scope="col" className="p-3">Owner</th><th scope="col" className="p-3">Status</th><th scope="col" className="p-3">Created</th><th scope="col" className="p-3">Action</th></tr></thead>
        <tbody className="divide-y divide-line">
          {items.map((item) => (
            <tr key={item.id}>
              <td className="max-w-64 p-3"><p className="wrap-break-word font-semibold text-black">{item.title}</p><p className="text-xs capitalize text-secondary">{item.status}</p></td>
              <td className="p-3 text-xs text-secondary" title={"client_id" in item ? item.client_id : item.provider_id}>#{("client_id" in item ? item.client_id : item.provider_id).slice(0, 8)}</td>
              <td className="p-3"><Status label={item.is_hidden ? "Hidden" : "Visible"} tone={item.is_hidden ? "warning" : "success"} /></td>
              <td className="p-3 whitespace-nowrap text-secondary">{formatAdminDate(item.created_at)}</td>
              <td className="p-3"><ModerationDialog targetType={resource === "projects" ? "project" : "service"} targetId={item.id} title={item.title} status={item.is_hidden ? "hidden" : "visible"} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
