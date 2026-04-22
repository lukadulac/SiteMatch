import { redirect } from "next/navigation";
import { ClientOnboardingForm } from "@/components/onboarding/client-onboarding-form";
import {
  getDashboardPathForRole,
  isClientProfileComplete,
} from "@/lib/auth/profile-completion";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientOnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || profile.role !== "client") {
    redirect("/login");
  }

  const { data: clientProfile } = await supabase
    .from("client_profiles")
    .select(
      "business_name, business_type, business_description, preferred_language",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  if (isClientProfileComplete(clientProfile)) {
    redirect(getDashboardPathForRole(profile.role));
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center px-5 py-6 sm:px-8 lg:px-10">
      <section className="grid overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[0_36px_90px_rgba(0,0,0,0.34)] lg:grid-cols-[0.86fr_1.14fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(180deg,#101629_0%,#182445_55%,#1b2340_100%)] p-8 sm:p-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbe4ff]">
              Client onboarding
            </p>
            <h1 className="text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
              Finish your
              <br />
              business profile
              <br />
              before you hire.
            </h1>
            <p className="max-w-md text-sm leading-7 text-[#d6def6] sm:text-base">
              A few business details help providers understand what you do and
              what kind of website support you need.
            </p>
          </div>
          <div className="rounded-[1.5rem] border border-white/12 bg-black/18 p-5 backdrop-blur-sm">
            <p className="text-xs uppercase tracking-[0.18em] text-[#dbe4ff]">
              Signed in as
            </p>
            <p className="mt-3 text-xl font-semibold text-[#f7f9ff]">
              {profile.full_name}
            </p>
            <p className="mt-2 text-sm leading-6 text-[#eef2ff]">
              Complete this step once, then you will land in your client
              dashboard automatically.
            </p>
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12">
          <ClientOnboardingForm clientProfile={clientProfile} />
        </div>
      </section>
    </main>
  );
}
