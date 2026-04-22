const trustPoints = [
  "Find the right web professional without sorting through random freelancers.",
  "Describe your business in simple terms, even if you do not have a website yet.",
  "Get matched with people who can design, build, and improve your online presence.",
];

const clientNeeds = [
  "I need my first business website",
  "My current website looks outdated",
  "I need more leads, bookings, or sales",
  "I need someone to manage the whole website project",
];

const howItWorks = [
  "Create your account and tell us about your business.",
  "Share what you need, even if you are starting from zero.",
  "Review providers and continue with the one that fits your goals.",
];

export default function Home() {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-8 px-5 py-6 sm:px-8 lg:px-10">
      <section className="overflow-hidden rounded-4xl border border-line bg-[linear-gradient(145deg,#101629_0%,#151d34_58%,#10182c_100%)] shadow-[0_36px_90px_rgba(0,0,0,0.34)]">
        <div className="grid gap-10 p-7 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
          <div className="space-y-8">
            <span className="inline-flex rounded-full border border-line-strong bg-white/3 px-4 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-secondary">
              SiteMatch
            </span>

            <div className="space-y-5">
              <h1 className="max-w-4xl text-5xl font-semibold leading-[0.95] tracking-[-0.04em] sm:text-6xl lg:text-7xl">
                Need a website
                <br />
                for your business?
                <br />
                Start here.
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted sm:text-lg">
                SiteMatch helps business owners find the right person or team to
                create, redesign, or improve their website without needing to
                know web jargon first.
              </p>
            </div>

            <div className="flex flex-wrap gap-3">
              <a
                href="/register"
                className="rounded-full bg-accent px-6 py-3.5 text-sm font-semibold text-accent-ink shadow-[0_18px_40px_rgba(20,168,0,0.28)] hover:bg-accent-strong"
              >
                Get started
              </a>
              <a
                href="/login"
                className="rounded-full border border-line-strong bg-white/4 px-6 py-3.5 text-sm font-semibold text-foreground hover:border-secondary/40 hover:bg-white/7"
              >
                I already have an account
              </a>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {trustPoints.map((point) => (
                <div
                  key={point}
                  className="rounded-3xl border border-line bg-black/12 p-5 backdrop-blur-sm"
                >
                  <p className="text-sm leading-6 text-muted">{point}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <div className="rounded-[1.7rem] border border-line bg-[linear-gradient(160deg,#171f35_0%,#12192c_100%)] p-6">
              <p className="text-xs uppercase tracking-[0.22em] text-secondary">
                Perfect if you are thinking:
              </p>
              <ul className="mt-5 space-y-3 text-sm leading-6 text-muted">
                {clientNeeds.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>

            <div className="rounded-3xl border border-line bg-panel-soft p-6">
              <p className="text-xs uppercase tracking-[0.18em] text-secondary">
                Good to know
              </p>
              <p className="mt-4 text-2xl font-semibold tracking-tight">
                You do not need an existing website to begin.
              </p>
              <p className="mt-3 text-sm leading-7 text-muted">
                Many clients start with just a business idea, a service list, or
                a rough goal. That is enough to begin.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-[1.75rem] border border-line bg-panel p-7">
          <p className="text-xs uppercase tracking-[0.22em] text-secondary">
            How it works
          </p>
          <ol className="mt-5 space-y-4 text-sm leading-7 text-muted sm:text-base">
            {howItWorks.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </div>

        <div className="rounded-[1.75rem] border border-line bg-[linear-gradient(145deg,#171f35_0%,#10182c_100%)] p-7">
          <p className="text-xs uppercase tracking-[0.22em] text-secondary">
            Made for small businesses
          </p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            First website, redesign, or growth push.
          </h2>
          <p className="mt-4 text-sm leading-7 text-muted sm:text-base">
            Whether you are opening something new or finally replacing an old
            website, the goal is the same: make it easier to find the right
            expert and move forward with confidence.
          </p>
        </div>
      </section>
    </main>
  );
}
