import Link from "next/link";
import { redirect } from "next/navigation";
import { getDashboardPathForRole, resolvePostAuthPath } from "@/lib/auth/profile-completion";
import { isAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function NewListingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (!profile || !isAppRole(profile.role)) {
    redirect("/login");
  }

  if (profile.role !== "client") {
    redirect(profile.role === "provider" ? "/oglasi" : getDashboardPathForRole(profile.role));
  }

  const resolved = await resolvePostAuthPath(supabase, user.id, profile.role);

  if (resolved.path !== "/dashboard/client") {
    redirect(resolved.path);
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-5xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[2rem] border border-line bg-[linear-gradient(145deg,#11192f_0%,#16223f_60%,#10182c_100%)] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
          Novi oglas
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
          Klijentova stranica za raspisivanje oglasa
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d6def6] sm:text-base">
          Ovu stranicu moze da koristi samo ulogovani klijent sa zavrsenim
          profilom. Provider moze da pregleda oglase i da aplicira, ali ne moze
          da raspise oglas ove vrste.
        </p>
      </section>

      <section className="rounded-[1.75rem] border border-line bg-panel-soft p-7">
        <h2 className="text-2xl font-semibold tracking-tight">
          Šta će forma sadržati
        </h2>
        <div className="mt-5 grid gap-4 text-sm leading-7 text-muted sm:grid-cols-2">
          <div className="rounded-3xl border border-line bg-panel p-5">
            Naslov oglasa, opis projekta, cilj sajta i tip budžeta.
          </div>
          <div className="rounded-3xl border border-line bg-panel p-5">
            Rok, potreba za dizajnom, SEO-om, pisanjem sadržaja i tip providera.
          </div>
        </div>
        <div className="mt-6">
          <Link
            href="/dashboard/client"
            className="inline-flex rounded-full border border-line-strong bg-white/4 px-5 py-3 text-sm font-semibold text-foreground transition hover:bg-white/8"
          >
            Idi na client profil
          </Link>
        </div>
      </section>
    </main>
  );
}
