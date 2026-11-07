import { redirect } from "next/navigation";
import { api } from "@/lib/api/server";
import { getDashboardPath } from "@/lib/contracts/auth/roles";
import type { SessionBootstrap } from "@/lib/contracts/session";

export default async function DashboardPage() {
  // The backend creates the profile if needed; on failure it signs the user out.
  const result = await api<SessionBootstrap>("/api/session/bootstrap", { method: "POST" });

  if (!result.ok) {
    if (result.status >= 500) {
      throw new Error(result.error);
    }

    redirect("/login");
  }

  redirect(getDashboardPath(result.data.role));
}
