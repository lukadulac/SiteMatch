import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/actions";
import { ProviderProfileForm } from "@/components/dashboard/provider-profile-form";
import {
  getOnboardingPathForRole,
  isProviderProfileComplete,
} from "@/lib/auth/profile-completion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ProviderDashboardPage() {
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

  if (!profile || profile.role !== "provider") {
    redirect("/login");
  }

  const { data: providerProfile } = await supabase
    .from("provider_profiles")
    .select(
      "provider_type, headline, bio, years_of_experience, portfolio_url, availability, hourly_rate_min, hourly_rate_max, fixed_price_min, fixed_price_max",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  const isProfileComplete = isProviderProfileComplete(providerProfile);

  if (!isProfileComplete) {
    redirect(getOnboardingPathForRole(profile.role));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <div className="grid gap-6 bg-[linear-gradient(120deg,#101629_0%,#18284a_50%,#1e3055_100%)] p-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#dbe4ff]">
              Provider dashboard
            </p>
            <h1 className="text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
              Welcome back, {profile.full_name}
            </h1>
            <p className="max-w-2xl text-sm leading-7 text-[#d6def6] sm:text-base">
              Your provider account is active and mapped to the `profiles` and
              `provider_profiles` tables in Supabase.
            </p>
          </div>
          <div className="rounded-[1.6rem] border border-white/12 bg-black/18 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[#dbe4ff]">
              Profile headline
            </p>
            <div className="mt-3 inline-flex rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-[#dcffd4]">
              Profile {isProfileComplete ? "complete" : "incomplete"}
            </div>
            <p className="mt-3 text-3xl font-semibold tracking-tight text-[#f7f9ff]">
              {providerProfile?.headline ?? "Not set"}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#d6def6]">
              {providerProfile?.provider_type ??
                "Choose a provider type to define how clients see you."}
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
            <h2 className="text-2xl font-semibold tracking-tight">Account</h2>
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
                <dt className="font-medium text-foreground">Availability</dt>
                <dd>{providerProfile?.availability ?? "Not set"}</dd>
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
            <h2 className="text-2xl font-semibold tracking-tight">Provider profile</h2>
            <dl className="mt-5 space-y-4 text-sm leading-7 text-muted sm:text-base">
              <div>
                <dt className="font-medium text-foreground">Provider type</dt>
                <dd>{providerProfile?.provider_type ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Headline</dt>
                <dd>{providerProfile?.headline ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Years of experience</dt>
                <dd>
                  {providerProfile?.years_of_experience != null
                    ? providerProfile.years_of_experience
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Portfolio URL</dt>
                <dd>{providerProfile?.portfolio_url ?? "Not set"}</dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Hourly range</dt>
                <dd>
                  {providerProfile?.hourly_rate_min != null ||
                  providerProfile?.hourly_rate_max != null
                    ? `${providerProfile?.hourly_rate_min ?? 0} - ${providerProfile?.hourly_rate_max ?? 0}`
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Fixed range</dt>
                <dd>
                  {providerProfile?.fixed_price_min != null ||
                  providerProfile?.fixed_price_max != null
                    ? `${providerProfile?.fixed_price_min ?? 0} - ${providerProfile?.fixed_price_max ?? 0}`
                    : "Not set"}
                </dd>
              </div>
              <div>
                <dt className="font-medium text-foreground">Bio</dt>
                <dd>{providerProfile?.bio ?? "Not set"}</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="border-t border-line p-8">
          <div className="max-w-5xl rounded-[1.75rem] border border-line bg-panel-soft p-7">
            <h2 className="text-2xl font-semibold tracking-tight">
              Edit provider profile
            </h2>
            <p className="mt-3 text-sm leading-7 text-muted sm:text-base">
              Update the full set of provider-facing fields from your profile
              tables, including rates and availability.
            </p>
            <div className="mt-6">
              <ProviderProfileForm
                profile={{
                  full_name: profile.full_name,
                  phone: profile.phone,
                  country: profile.country,
                  city: profile.city,
                  avatar_url: profile.avatar_url,
                }}
                providerProfile={providerProfile}
              />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
