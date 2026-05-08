const backendStatus = [
  "Client registration flow is being reworked around the new business profile model.",
  "Provider onboarding is next, after the client backend is fully locked down.",
  "Project listing flow stays in backend mode until the domain rules are finished.",
];

const currentScope = [
  "Authentication and role provisioning",
  "Client onboarding data model",
  "Provider onboarding backend redesign",
  "Project domain and listing lifecycle",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-5 py-10 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-[2rem] border border-black/10 bg-white shadow-[0_25px_80px_rgba(0,0,0,0.08)]">
        <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-12">
          <div className="space-y-6">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#6b7280]">
              Temporary Landing
            </p>
            <h1 className="max-w-4xl text-4xl font-semibold leading-[0.95] tracking-[-0.05em] text-[#111111] sm:text-5xl lg:text-6xl">
              SiteMatch je trenutno
              <br />
              u backend-first fazi.
            </h1>
            <p className="max-w-2xl text-base leading-8 text-[#4b5563] sm:text-lg">
              Frontend je sveden na privremenu landing stranicu dok se ne
              zakljuce auth, onboarding i project domain pravila.
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/register"
                className="rounded-full border border-black bg-black px-6 py-3 text-sm font-semibold text-white transition hover:bg-black/85"
              >
                Register
              </a>
              <a
                href="/login"
                className="rounded-full border border-black/10 px-6 py-3 text-sm font-semibold text-[#111111] transition hover:bg-black/4"
              >
                Login
              </a>
            </div>
          </div>

          <div className="rounded-[1.5rem] border border-black/10 bg-[#f4f4f5] p-6">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#6b7280]">
              Trenutni fokus
            </p>
            <ul className="mt-5 space-y-3 text-sm leading-6 text-[#3f3f46]">
              {currentScope.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-3">
        {backendStatus.map((item, index) => (
          <article
            key={item}
            className="rounded-[1.5rem] border border-black/10 bg-white p-6 shadow-[0_18px_50px_rgba(0,0,0,0.05)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[#9ca3af]">
              0{index + 1}
            </p>
            <p className="mt-4 text-sm leading-7 text-[#3f3f46]">{item}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
