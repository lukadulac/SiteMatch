import Link from "next/link";
import { isAppRole } from "@/lib/auth/roles";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const navItems = [
  { href: "/oglasi", label: "Oglasi" },
  { href: "/dashboard", label: "User profile" },
];

export async function SiteHeader() {
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

    if (profile && isAppRole(profile.role)) {
      role = profile.role;
    }
  }

  const items =
    role === "client"
      ? [...navItems, { href: "/oglasi/novi", label: "Raspisi oglas" }]
      : navItems;

  return (
    <header className="border-b border-line bg-[linear-gradient(180deg,rgba(9,13,25,0.96)_0%,rgba(14,20,37,0.92)_100%)] backdrop-blur">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="text-lg font-semibold tracking-[-0.03em] text-[#f7f9ff]"
        >
          SiteMatch
        </Link>

        <nav aria-label="Primary" className="flex flex-wrap items-center gap-2">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-line-strong bg-white/4 px-4 py-2 text-sm font-medium text-[#dbe4ff] transition hover:border-secondary/40 hover:bg-white/8 hover:text-white"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
