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
    <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="rounded-[2rem] border border-line bg-white/90 p-4 shadow-[0_20px_60px_rgba(17,17,17,0.06)]">
        <nav aria-label="Dashboard navigation">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`flex items-center justify-between rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                    item.active
                      ? "bg-linear-to-r from-violet-500 to-pink-500 text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)]"
                      : "text-secondary hover:bg-black/4 hover:text-black"
                  }`}
                >
                  <span>{item.label}</span>
                  {item.count ? (
                    <span
                      className={`inline-flex min-w-7 items-center justify-center rounded-full px-2 py-1 text-xs ${
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

      <div className="space-y-8">
        <div className="flex flex-col gap-5 rounded-[2rem] border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-8 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-black sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-secondary sm:text-base">
              {subtitle}
            </p>
          </div>
          {actionHref && actionLabel ? (
            <Link
              href={actionHref}
              className="inline-flex items-center justify-center rounded-2xl bg-linear-to-r from-violet-500 to-pink-500 px-5 py-3 text-sm font-semibold text-white shadow-[0_16px_40px_rgba(168,85,247,0.25)] transition hover:opacity-90"
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
    <div className="rounded-[1.75rem] border border-line bg-white p-6 shadow-[0_16px_40px_rgba(17,17,17,0.04)]">
      <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-linear-to-br from-violet-500 to-pink-500 text-lg font-semibold text-white">
        {label.charAt(0)}
      </div>
      <p className="text-4xl font-semibold text-black">{value}</p>
      <p className="mt-3 text-base font-semibold text-black">{label}</p>
      <p className="mt-1 text-sm text-secondary">{detail}</p>
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
    <section className="rounded-[2rem] border border-line bg-white/90 p-6 shadow-[0_20px_60px_rgba(17,17,17,0.06)] sm:p-7">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold text-black">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}
