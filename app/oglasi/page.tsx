import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const sampleListings = [
  {
    title: "Redesign sajta za restoran",
    budget: "1.000 - 2.500 EUR",
    summary:
      "Potrebna je modernizacija postojećeg sajta, online meni i jasna forma za rezervacije.",
  },
  {
    title: "Izrada sajta za advokatsku kancelariju",
    budget: "800 - 1.800 EUR",
    summary:
      "Klijent traži ozbiljan, brz i pregledan sajt sa uslugama, biografijama i kontakt formom.",
  },
  {
    title: "Landing stranica za novu SaaS uslugu",
    budget: "600 - 1.200 EUR",
    summary:
      "Fokus je na konverziji, jasnom copyju i povezivanju sa postojećim analitikama.",
  },
];

export default async function ListingsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;

  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    role = profile?.role ?? null;
  }

  return (
    <main className="mx-auto flex min-h-full w-full max-w-7xl flex-col gap-8 px-5 py-8 sm:px-8 lg:px-10">
      <section className="rounded-[2rem] border border-line bg-[linear-gradient(145deg,#101629_0%,#182445_58%,#11192f_100%)] p-8 shadow-[0_28px_80px_rgba(0,0,0,0.28)]">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
          Oglasi
        </p>
        <h1 className="mt-4 text-4xl font-semibold tracking-[-0.04em] text-[#f7f9ff] sm:text-5xl">
          Aktivni oglasi klijenata
        </h1>
        <p className="mt-4 max-w-3xl text-sm leading-7 text-[#d6def6] sm:text-base">
          Ovde će provideri pregledati aktivne zahteve, budžete i sažetke
          projekata pre nego što pošalju prijavu.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          {role === "client" ? (
            <Link
              href="/oglasi/novi"
              className="rounded-full bg-accent px-5 py-3 text-sm font-semibold text-accent-ink"
            >
              Raspisi novi oglas
            </Link>
          ) : null}
          {role === "provider" ? (
            <div className="rounded-full border border-line-strong bg-white/6 px-5 py-3 text-sm font-medium text-[#dbe4ff]">
              Kao provider mozes da pregledas oglase i apliciras na njih.
            </div>
          ) : null}
          {role === "admin" ? (
            <div className="rounded-full border border-line-strong bg-white/6 px-5 py-3 text-sm font-medium text-[#dbe4ff]">
              Kao admin mozes da vidis sve oglase i da pratis sta se desava na sajtu.
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {sampleListings.map((listing) => (
          <article
            key={listing.title}
            className="rounded-[1.75rem] border border-line bg-panel-soft p-6"
          >
            <p className="text-xs uppercase tracking-[0.18em] text-secondary">
              {listing.budget}
            </p>
            <h2 className="mt-4 text-2xl font-semibold tracking-tight">
              {listing.title}
            </h2>
            <p className="mt-4 text-sm leading-7 text-muted">
              {listing.summary}
            </p>
            {role === "provider" ? (
              <button
                type="button"
                className="mt-5 rounded-full border border-line-strong bg-white/4 px-4 py-2 text-sm font-semibold text-foreground transition hover:bg-white/8"
              >
                Apliciraj
              </button>
            ) : null}
          </article>
        ))}
      </section>
    </main>
  );
}
