import Link from "next/link";
import type { ReactNode } from "react";

type DashboardNavItem = {
  href: string;
  label: string;
  count?: number;
  active?: boolean;
};

type DashboardShellProps = {
  title: string;
  subtitle: string;
  actionHref?: string;
  actionLabel?: string;
  navItems: DashboardNavItem[];
  children: ReactNode;
};

export function DashboardShell({
  title,
  subtitle,
  actionHref,
  actionLabel,
  navItems,
  children,
}: DashboardShellProps) {
  return (
    <div className="grid min-w-0 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
      <aside className="min-w-0 max-w-full lg:sticky lg:top-28 lg:self-start">
        <nav aria-label="Dashboard navigation" className="max-w-full overflow-hidden">
          <ul className="flex max-w-full gap-2 overflow-x-auto overscroll-x-contain rounded-[1.25rem] border border-line bg-white/80 p-2 shadow-[0_16px_45px_rgba(17,17,17,0.04)] lg:flex-col lg:overflow-visible lg:rounded-[1.5rem]">
            {navItems.map((item) => (
              <li key={item.href} className="shrink-0 lg:shrink">
                <Link
                  href={item.href}
                  className={`flex min-h-10 items-center justify-between gap-2 rounded-[0.9rem] px-3 py-2 text-sm font-semibold transition sm:min-h-11 sm:px-4 sm:py-2.5 lg:w-full ${
                    item.active
                      ? "bg-linear-to-r from-violet-500 to-pink-500 text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)]"
                      : "text-secondary hover:bg-black/4 hover:text-black"
                  }`}
                >
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.count ? (
                    <span
                      className={`inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs ${
                        item.active
                          ? "bg-white/20 text-white"
                          : "bg-linear-to-r from-violet-500 to-pink-500 text-white"
                      }`}
                    >
                      {item.count}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="min-w-0 max-w-full space-y-6 overflow-hidden">
        <div className="flex flex-col gap-5 border-b border-line pb-6 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h1 className="break-words text-3xl font-semibold text-black sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
              {subtitle}
            </p>
          </div>
          {actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="inline-flex min-h-11 w-full shrink-0 items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90 sm:w-auto"
            >
              {actionLabel}
            </Link>
          ) : null}
        </div>

        {children}
      </div>
    </div>
  );
}

type StatCardProps = {
  value: string;
  label: string;
  detail: string;
};

export function DashboardStatCard({ value, label, detail }: StatCardProps) {
  return (
    <div className="min-w-0 rounded-4xl border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 text-lg font-semibold text-white">
        {label.charAt(0)}
      </div>
      <p className="break-words text-3xl font-semibold text-black sm:text-4xl">
        {value}
      </p>
      <p className="mt-3 break-words text-base font-semibold text-black">{label}</p>
      <p className="mt-1 break-words text-sm text-secondary">{detail}</p>
    </div>
  );
}

type DashboardPanelProps = {
  title: string;
  action?: ReactNode;
  children: ReactNode;
};

export function DashboardPanel({
  title,
  action,
  children,
}: DashboardPanelProps) {
  return (
    <section className="min-w-0 rounded-4xl border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-7">
      <div className="mb-6 flex min-w-0 items-center justify-between gap-4">
        <h2 className="min-w-0 break-words text-2xl font-semibold text-black">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}
