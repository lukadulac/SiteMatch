import { redirect } from "next/navigation";
import {
  DashboardPanel,
  DashboardShell,
} from "@/components/dashboard/DashboardShell";
import { ProviderProfileForm } from "@/components/dashboard/provider-profile-form";
import { ensureUserProfile } from "@/lib/auth/provision";
import { getDashboardPath } from "@/lib/auth/roles";
import { getUserConversations } from "@/lib/messaging/service";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function isProviderProfileReady(profile: {
  provider_type: string;
  years_of_experience: number | null;
  portfolio_url: string | null;
  service_categories: string[];
  service_category_other_text: string | null;
}) {
  return (
    profile.provider_type.length > 0 &&
    profile.years_of_experience != null &&
    typeof profile.portfolio_url === "string" &&
    profile.portfolio_url.trim().length > 0 &&
    profile.service_categories.length > 0 &&
    (!profile.service_categories.includes("other") ||
      (profile.service_category_other_text ?? "").trim().length > 0)
  );
}

export default async function ProviderProfilePage() {
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

  const [profileResult, providerProfileResult, conversationsResult, applicationsResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("full_name, phone, country, city")
        .eq("id", user.id)
        .single(),
      supabase
        .from("provider_profiles")
        .select(
          "provider_type, tax_id, years_of_experience, portfolio_url, social_link, service_categories, service_category_other_text, about, average_rating, total_reviews, is_verified",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      getUserConversations(supabase, user.id),
      supabase.from("applications").select("id").eq("provider_id", user.id),
    ]);

  if (profileResult.error || !profileResult.data) {
    throw new Error(profileResult.error?.message ?? "Profile could not be loaded.");
  }

  if (providerProfileResult.error || !providerProfileResult.data) {
    throw new Error(
      providerProfileResult.error?.message ?? "Provider profile could not be loaded.",
    );
  }

  if (conversationsResult.error) {
    throw new Error(conversationsResult.error);
  }

  if (applicationsResult.error) {
    throw new Error(applicationsResult.error.message);
  }

  const profile = profileResult.data;
  const providerProfile = providerProfileResult.data;
  const conversations = conversationsResult.data ?? [];
  const applications = applicationsResult.data ?? [];
  const unreadConversations = conversations.filter(
    (conversation) => conversation.unread_count > 0,
  );
  const isReady = isProviderProfileReady(providerProfile);

  return (
    <DashboardShell
      title="Profile"
      subtitle="Keep your provider profile ready so clients can evaluate your fit quickly."
      navItems={[
        { href: "/dashboard/provider", label: "Overview" },
        {
          href: "/dashboard/provider/applications",
          label: "Applications",
          count: applications.length,
        },
        { href: "/dashboard/provider/services", label: "Services" },
        {
          href: "/dashboard/messages",
          label: "Messages",
          count: unreadConversations.length,
        },
        { href: "/dashboard/provider/profile", label: "Profile", active: true },
      ]}
    >
      <section
        className={`rounded-4xl border p-5 sm:p-6 ${
          isReady ? "border-green-200 bg-green-50" : "border-amber-200 bg-amber-50"
        }`}
      >
        <p className="text-sm font-semibold uppercase tracking-[0.14em] text-black">
          Profile progress
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-black">
          {isReady
            ? "Your provider profile is ready"
            : "Finish your provider profile"}
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-secondary">
          {isReady
            ? "Your provider profile contains the key details clients need before reaching out."
            : "Complete the remaining provider fields so your public-facing information and matching signals are ready."}
        </p>
      </section>

      <DashboardPanel title="Provider Profile">
        <ProviderProfileForm profile={profile} providerProfile={providerProfile} />
      </DashboardPanel>
    </DashboardShell>
  );
}
