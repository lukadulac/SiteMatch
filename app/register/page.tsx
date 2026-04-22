import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { resolvePostAuthPath } from "@/lib/auth/profile-completion";
import { isAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profile && isAppRole(profile.role)) {
      const resolved = await resolvePostAuthPath(supabase, user.id, profile.role);
      redirect(resolved.path);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col justify-center px-5 py-6 sm:px-8 lg:px-10">
      <div className="grid overflow-hidden rounded-[2rem] border border-line bg-panel shadow-[0_36px_90px_rgba(0,0,0,0.34)] lg:grid-cols-[0.84fr_1.16fr]">
        <div className="flex flex-col justify-between bg-[linear-gradient(180deg,#101629_0%,#182445_55%,#1b2340_100%)] p-8 sm:p-10">
          <div className="space-y-5">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#dbe4ff]">
              Register
            </p>
            <h1 className="text-4xl font-semibold leading-[0.96] tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
              Tell us who you are
              <br />
              and what kind of
              <br />
              help you need.
            </h1>
            <p className="max-w-md text-sm leading-7 text-[#d6def6] sm:text-base">
              If you are a business owner, choose client. If you build websites
              or offer related services, choose provider.
            </p>
          </div>
          <div className="grid gap-4">
            <div className="rounded-[1.5rem] border border-white/12 bg-black/18 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[#dbe4ff]">
                Client
              </p>
              <p className="mt-3 text-sm leading-6 text-[#eef2ff]">
                Best for business owners who need a new website, redesign, or
                website support.
              </p>
            </div>
            <div className="rounded-[1.5rem] border border-white/12 bg-black/18 p-5 backdrop-blur-sm">
              <p className="text-xs uppercase tracking-[0.18em] text-[#dbe4ff]">
                Provider
              </p>
              <p className="mt-3 text-sm leading-6 text-[#eef2ff]">
                Best for freelancers, agencies, or studios offering web
                services.
              </p>
            </div>
          </div>
        </div>

        <div className="p-8 sm:p-10 lg:p-12">
          <RegisterForm />
        </div>
      </div>
    </main>
  );
}
