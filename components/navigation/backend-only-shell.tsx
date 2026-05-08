import Link from "next/link";

type BackendOnlyShellProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export function BackendOnlyShell({
  eyebrow,
  title,
  description,
}: BackendOnlyShellProps) {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center px-5 py-10 sm:px-8 lg:px-10">
      <section className="w-full rounded-[2rem] border border-black/10 bg-white p-8 shadow-[0_25px_80px_rgba(0,0,0,0.08)] sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b7280]">
          {eyebrow}
        </p>
        <h1 className="mt-4 max-w-3xl text-4xl font-semibold leading-[0.95] tracking-[-0.05em] text-[#111111] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-8 text-[#4b5563] sm:text-lg">
          {description}
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="rounded-full border border-black bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/85"
          >
            Nazad na landing
          </Link>
        </div>
      </section>
    </main>
  );
}
