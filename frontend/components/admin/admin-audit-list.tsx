import type { z } from "zod";
import type { adminRowSchemas } from "@/lib/admin/ui";

type AuditEvent = z.infer<typeof adminRowSchemas.audit>;

export function formatAdminDate(value: string) {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function AdminAuditList({ items }: { items: AuditEvent[] }) {
  if (items.length === 0) {
    return <p className="border-t border-line py-8 text-sm text-secondary">No moderation decisions yet.</p>;
  }

  return (
    <ol className="divide-y divide-line border-y border-line">
      {items.map((item) => (
        <li key={item.id} className="grid gap-2 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:gap-4">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black">
              <span className="capitalize">{item.action}</span> {item.target_type}
              <span className="ml-2 font-normal text-secondary" title={item.target_id}>#{item.target_id.slice(0, 8)}</span>
            </p>
            <p className="mt-1 wrap-break-word text-sm text-secondary">{item.reason}</p>
            <p className="mt-1 text-xs text-secondary" title={item.actor_id}>By admin #{item.actor_id.slice(0, 8)}</p>
          </div>
          <time dateTime={item.created_at} className="text-xs text-secondary sm:text-right">{formatAdminDate(item.created_at)}</time>
        </li>
      ))}
    </ol>
  );
}
