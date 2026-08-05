import { redirect } from "next/navigation";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { ClientProfileForm } from "@/components/dashboard/client-profile-form";
import { isClientProfileComplete } from "@/lib/auth/profile-completion";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { getClientProjects } from "@/lib/projects/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientProfilePage() {
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

  const [profileResult, clientProfileResult, projectsResult, conversationsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, country, city")
        .eq("id", user.id)
        .single(),
      supabase
        .from("client_profiles")
        .select(
          "business_name, business_tax_id, business_type, business_type_text, project_idea, website_url, company_size, interested_solution_types, interested_solution_other_text",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getClientProjects(supabase, user.id),
      getUserConversations(supabase, user.id),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message ?? "Profile could not be loaded.");
  }

  if (clientProfileResult.error) {
    throw new Error(clientProfileResult.error.message);
  }

  if (projectsResult.error) {
    throw new Error(projectsResult.error);
  }

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  const profile = profileResult.data;
  const clientProfile = clientProfileResult.data;
  const projects = projectsResult.data ?? [];
  const unreadConversations = (conversationsResult.data ?? []).filter(
    (conversation) => conversation.unread_count > 0,
  );
  const isComplete = isClientProfileComplete(clientProfile);

  return (
    <DashboardShell
      title="Profile"
      subtitle="Keep your business profile and account details ready for project creation and provider matching."
      navItems={[
        { href: "/dashboard/client", label: "Overview" },
        {
          href: "/dashboard/client/projects",
          label: "Projects",
          count: projects.length,
        },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/client/profile", label: "Profile", active: true },
      ]}
    >
      <section
        className={`rounded-4xl border p-5 sm:p-6 ${
          isComplete
            ? "border-green-200 bg-green-50"
            : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-black">
          Profile progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-black">
          {isComplete ? "Your client profile is complete" : "Finish your client profile"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
          {isComplete
            ? "Your profile is ready and you can continue posting projects and managing incoming conversations."
            : "Complete the remaining client fields so your business profile is ready for better provider matching."}
        </p>
      </section>

      <DashboardPanel title="Client Profile">
        <ClientProfileForm profile={profile} clientProfile={clientProfile} />
      </DashboardPanel>
    </DashboardShell>
  );
}
