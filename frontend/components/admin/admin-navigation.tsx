"use client";

import { usePathname } from "next/navigation";
import { DashboardSidebar } from "@/components/dashboard/DashboardShell";
import { getAdminNavigation } from "@/lib/navigation/menu-items";

export function AdminNavigation() {
  const pathname = usePathname();

  return (
    <div className="min-w-0 max-w-full lg:sticky lg:top-28 lg:self-start">
      <DashboardSidebar label="Administration" items={getAdminNavigation(pathname)} />
    </div>
  );
}
