import Link from "next/link";

export async function SiteHeader() {
  return (
    <header className="border-b border-black/10 bg-white/88 backdrop-blur">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 px-5 py-4 sm:px-8 lg:px-10">
        <Link
          href="/"
          className="text-lg font-semibold tracking-[-0.04em] text-[#111111]"
        >
          SiteMatch
        </Link>

        <div className="rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-[#52525b]">
          Backend only
        </div>
      </div>
    </header>
  );
}
