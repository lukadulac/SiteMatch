import type { ReactNode } from "react";
import { notFound, redirect } from "next/navigation";
import { AdminNavigation } from "@/components/admin/admin-navigation";
import { requireAdmin } from "@/lib/admin/service";
import { getLoginHref } from "@/lib/auth/return-url";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminLayout({
	children,
}: {
	children: ReactNode;
}) {
	const access = await requireAdmin(await createSupabaseServerClient());
	if (access.error) {
		if (access.status === 401) redirect(getLoginHref("/dashboard/admin"));
		notFound();
	}

	return (
		<div className="min-w-0 space-y-7 py-4">
			<div className="grid min-w-0 gap-7 lg:grid-cols-[220px_minmax(0,1fr)]">
				<AdminNavigation />
				<div className="min-w-0">{children}</div>
			</div>
		</div>
	);
}
