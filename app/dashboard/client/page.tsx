import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { ClientProfileForm } from "@/components/dashboard/client-profile-form";
import {
  getOnboardingPathForRole,
  isClientProfileComplete,
} from "@/lib/auth/profile-completion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientDashboardPage() {
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

  if (!profile || profile.role !== "client") {
    redirect("/login");
  }

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select(
      "business_name, business_type, business_description, website_url, company_size, preferred_language",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const isProfileComplete = isClientProfileComplete(clientProfile);

  if (!isProfileComplete) {
    redirect(getOnboardingPathForRole(profile.role));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <div className="grid gap-6 bg-[linear-gradient(120deg,#101629_0%,#18284a_55%,#1c2442_100%)] p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#dbe4ff]">
              Client dashboard
            </p>
            <h1 className="text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
              Welcome back, {profile.full_name}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#d6def6] sm:text-base">
              This is your client space for planning your website project and
              preparing to connect with the right provider.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-white/12 bg-black/18 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[#dbe4ff]">
              Business snapshot
            </p>
            <div className="mt-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#dcffd4]">
              Profile {isProfileComplete ? "complete" : "incomplete"}
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f9ff]">
              {clientProfile?.business_name ?? "Not set"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#d6def6]">
              {clientProfile?.business_type ??
                "Add a few business details when you are ready so providers understand what you need."}
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

        <div className="grid gap-6 p-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <h2 className="text-2xl font-semibold tracking-tight">Your account</h2>
            <dl className="mt-5 space-y-4 text-sm leading-7 text-muted sm:text-base">
              <div>
                <dt className="font-medium text-foreground">Email</dt>
                <dd>{profile.email}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Role</dt>
                <dd>{profile.role}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Profile status</dt>
                <dd>{isProfileComplete ? "Completed" : "Incomplete"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Phone</dt>
                <dd>{profile.phone ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Country</dt>
                <dd>{profile.country ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">City</dt>
                <dd>{profile.city ?? "Not set"}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <h2 className="text-2xl font-semibold tracking-tight">Your business</h2>
            <dl className="mt-5 space-y-4 text-sm leading-7 text-muted sm:text-base">
              <div>
                <dt className="font-medium text-foreground">Business name</dt>
                <dd>{clientProfile?.business_name ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Business type</dt>
                <dd>{clientProfile?.business_type ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Preferred language</dt>
                <dd>{clientProfile?.preferred_language ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Summary</dt>
                <dd>
                  {clientProfile?.business_description ??
                    "Tell providers what your business does and what kind of website you want to build."}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Website</dt>
                <dd>{clientProfile?.website_url ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Company size</dt>
                <dd>{clientProfile?.company_size ?? "Not set"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="border-t border-line p-8">
          <div className="max-w-4xl rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <h2 className="text-2xl font-semibold tracking-tight">
              Edit client profile
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
              Update the full set of profile fields available in your client and
              account tables.
            </p>
            <div className="mt-6">
              <ClientProfileForm
                profile={{
                  full_name: profile.full_name,
                  phone: profile.phone,
                  country: profile.country,
                  city: profile.city,
                  avatar_url: profile.avatar_url,
                }}
                clientProfile={clientProfile}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
