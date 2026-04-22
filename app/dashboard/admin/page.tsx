import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { AdminProfileForm } from "@/components/dashboard/admin-profile-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function AdminDashboardPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, email, role, phone, country, city, avatar_url")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/login");
  }

  const { count: profileCount } = await supabase
    .from("profiles")
    .select("*", { count: "exact", head: true });

  const { count: clientCount } = await supabase
    .from("client_profiles")
    .select("*", { count: "exact", head: true });

  const { count: providerCount } = await supabase
    .from("provider_profiles")
    .select("*", { count: "exact", head: true });

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <div className="grid gap-6 bg-[linear-gradient(120deg,#101629_0%,#1a2240_55%,#222b4f_100%)] p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#dbe4ff]">
              Admin dashboard
            </p>
            <h1 className="text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
              Welcome back, {profile.full_name}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#d6def6] sm:text-base">
              This area is reserved for administrator accounts and gives you a
              high-level view of marketplace activity.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-white/12 bg-black/18 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[#dbe4ff]">
              Admin account
            </p>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f9ff]">
              {profile.email}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#d6def6]">
              Use this dashboard for oversight, moderation, and operations.
            </p>
            <form action={logoutAction} className="mt-6">
              <button
                type="submit"
                className="rounded-full border border-white/20 bg-white/8 px-5 py-3 text-sm font-semibold text-white transition hover:bg-white/14"
              >
                Log out
              </button>
            </form>
          </div>
        </div>

        <div className="grid gap-6 p-8 lg:grid-cols-3">
          <div className="rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-secondary">
              Total users
            </p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">
              {profileCount ?? 0}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-secondary">
              Clients
            </p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">
              {clientCount ?? 0}
            </p>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <p className="text-xs uppercase tracking-[0.18em] text-secondary">
              Providers
            </p>
            <p className="mt-4 text-4xl font-semibold tracking-tight">
              {providerCount ?? 0}
            </p>
          </div>
        </div>

        <div className="border-t border-line p-8">
          <div className="max-w-4xl rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <h2 className="text-2xl font-semibold tracking-tight">
              Edit admin profile
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
              Update your own admin profile fields stored in `profiles`.
            </p>
            <div className="mt-6">
              <AdminProfileForm
                profile={{
                  full_name: profile.full_name,
                  phone: profile.phone,
                  country: profile.country,
                  city: profile.city,
                  avatar_url: profile.avatar_url,
                }}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
